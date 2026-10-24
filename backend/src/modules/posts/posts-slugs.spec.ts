import type { Cache } from 'cache-manager';
import type { PrismaService } from '../../prisma/prisma.service';
import { PostsService } from './posts.service';

function database() {
  const posts = new Map<
    string,
    {
      id: string;
      slug: string;
      title: string;
      status: string;
      featured: boolean;
    }
  >();
  const collision = Object.assign(new Error('Unique slug conflict'), {
    code: 'P2002',
    meta: { target: ['slug'] },
  });
  const prisma = {
    post: {
      findUnique: ({ where }: { where: { slug?: string; id?: string } }) =>
        Promise.resolve(
          where.id
            ? posts.get(where.id)
            : [...posts.values()].find((post) => post.slug === where.slug),
        ),
      create: ({
        data,
      }: {
        data: {
          slug: string;
          title: string;
          status: string;
          featured: boolean;
        };
      }) => {
        if ([...posts.values()].some((post) => post.slug === data.slug))
          return Promise.reject(collision);
        const post = {
          ...data,
          id: `00000000-0000-4000-8000-${String(posts.size).padStart(12, '0')}`,
        };
        posts.set(post.id, post);
        return Promise.resolve(post);
      },
      update: ({
        where,
        data,
      }: {
        where: { id: string };
        data: { slug: string; title?: string };
      }) => {
        if (
          [...posts.values()].some(
            (post) => post.id !== where.id && post.slug === data.slug,
          )
        )
          return Promise.reject(collision);
        const post = { ...posts.get(where.id)!, ...data };
        posts.set(where.id, post);
        return Promise.resolve(post);
      },
    },
  };
  return {
    posts,
    prisma,
    service: new PostsService(prisma as unknown as PrismaService, {} as Cache),
  };
}
describe('post slug allocation', () => {
  it('recovers when concurrent creates choose the same available slug', async () => {
    const { service } = database();
    const results = await Promise.all([
      service.create({ title: 'Same title' }),
      service.create({ title: 'Same title' }),
    ]);
    expect(results.map((post) => post.slug).sort()).toEqual([
      'same-title',
      'same-title-1',
    ]);
  });
  it('recovers when concurrent renames choose the same slug', async () => {
    const { service } = database();
    const one = await service.create({ title: 'One' });
    const two = await service.create({ title: 'Two' });
    const results = await Promise.all([
      service.update(one.id, { title: 'Same' }),
      service.update(two.id, { title: 'Same' }),
    ]);
    expect(results.map((post) => post.slug).sort()).toEqual(['same', 'same-1']);
  });
  it('uses a readable nonempty fallback for punctuation-only slugs and titles', async () => {
    const { service } = database();
    expect((await service.create({ title: 'नया लेख', slug: '!!!' })).slug).toBe(
      'नया-लेख',
    );
    expect((await service.create({ title: '!!!', slug: '!!!' })).slug).toBe(
      'post',
    );
  });
  it('does not retry unrelated database failures', async () => {
    const { service, prisma } = database();
    const error = { code: 'P2002', meta: { target: ['other'] } };
    const write = jest.spyOn(prisma.post, 'create').mockRejectedValue(error);
    await expect(service.create({ title: 'One' })).rejects.toBe(error);
    expect(write).toHaveBeenCalledTimes(1);
  });
});
