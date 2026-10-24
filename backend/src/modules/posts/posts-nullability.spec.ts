import { validate } from 'class-validator';
import { UpdatePostDto } from './dto/update-post.dto';

describe('UpdatePostDto nullable field contract', () => {
  const version = '2026-10-24T12:00:00.001Z';
  it.each([
    'title',
    'slug',
    'content',
    'excerpt',
    'status',
    'featured',
    'tagIds',
  ])('rejects explicit null for %s', async (field) => {
    const dto = Object.assign(new UpdatePostDto(), {
      expectedUpdatedAt: version,
      [field]: null,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === field)).toBe(true);
  });
  it.each(['categoryId', 'featuredImage', 'seoTitle', 'seoDescription'])(
    'allows null to clear %s',
    async (field) => {
      const dto = Object.assign(new UpdatePostDto(), {
        expectedUpdatedAt: version,
        [field]: null,
      });
      expect(await validate(dto)).toEqual([]);
    },
  );
  it.each([undefined, null, '', 'not-a-date', '2026-02-30T12:00:00.000Z'])(
    'rejects missing or invalid revision timestamp %s',
    async (expectedUpdatedAt) => {
      const dto = Object.assign(new UpdatePostDto(), {
        title: 'Valid edit',
        expectedUpdatedAt,
      });
      expect(
        (await validate(dto)).some(
          (error) => error.property === 'expectedUpdatedAt',
        ),
      ).toBe(true);
    },
  );
  it('allows omitted fields when a valid revision timestamp is supplied', async () => {
    expect(
      await validate(
        Object.assign(new UpdatePostDto(), { expectedUpdatedAt: version }),
      ),
    ).toEqual([]);
  });
});
