import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from './categories.service';
import { TagsService } from '../tags/tags.service';

describe.each([
  ['categories', CategoriesService, 'category'],
  ['tags', TagsService, 'tag'],
] as const)('%s normalization and write conflicts', (_name, Service, model) => {
  function setup() {
    const record = { id: 'existing', name: 'Original name', slug: 'original-name' };
    const delegate = {
      findUnique: jest.fn(async ({ where }: { where: { id?: string; slug?: string } }) => where.id ? record : null),
      create: jest.fn(async ({ data }: { data: { name: string; slug: string } }) => ({ id: 'new', ...data })),
      update: jest.fn(async ({ data }: { data: { name: string; slug: string } }) => ({ ...record, ...data })),
    };
    return { service: new Service({ [model]: delegate } as unknown as PrismaService), delegate };
  }

  it.each([
    { name: '   ' }, { name: '!!!' }, { name: '---' },
    { name: 'Valid name', slug: '!!!' }, { name: 'Valid name', slug: '---' },
  ])('rejects a create whose normalized name or URL is empty: %j', async dto => {
    const { service, delegate } = setup();
    await expect(service.create(dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(delegate.create).not.toHaveBeenCalled();
  });

  it.each([
    { name: '   ' }, { name: '!!!' }, { name: '---' },
    { slug: '!!!' }, { slug: '---' },
  ])('rejects an update whose normalized name or URL is empty: %j', async dto => {
    const { service, delegate } = setup();
    await expect(service.update('existing', dto)).rejects.toBeInstanceOf(BadRequestException);
    expect(delegate.update).not.toHaveBeenCalled();
  });

  it('preserves valid Hindi names and Unicode slugs', async () => {
    const { service } = setup();
    await expect(service.create({ name: '  नई दुनिया  ' })).resolves.toMatchObject({ name: 'नई दुनिया', slug: 'नई-दुनिया' });
  });

  it('maps a create uniqueness race to a conflict response', async () => {
    const { service, delegate } = setup();
    delegate.create.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['slug'] } } as never);
    await expect(service.create({ name: 'Racing name' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('maps an update uniqueness race to a conflict response', async () => {
    const { service, delegate } = setup();
    delegate.update.mockRejectedValueOnce({ code: 'P2002', meta: { target: ['slug'] } } as never);
    await expect(service.update('existing', { slug: 'racing-name' })).rejects.toBeInstanceOf(ConflictException);
  });
});
