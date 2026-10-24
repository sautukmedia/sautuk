import { MediaService } from './media.service';
import type { PrismaService } from '../../prisma/prisma.service';
it('lists only images with bounded cursor pagination and no storage credentials', async () => {
  const findMany = jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue([
    {
      id: 'one',
      filename: 'a.jpg',
      cloudfrontUrl: 'https://cdn/a.jpg',
      s3Url: 'https://s3/a.jpg',
      uploadedAt: new Date(),
    },
    {
      id: 'two',
      filename: 'b.png',
      cloudfrontUrl: null,
      s3Url: 'https://s3/b.png',
      uploadedAt: new Date(),
    },
  ]);
  const service = new MediaService({
    media: { findMany },
  } as unknown as PrismaService);
  const result = await service.listImages(undefined, 1, 'photo');
  const args = findMany.mock.calls[0][0] as {
    take: number;
    where: { AND: unknown[] };
  };
  expect(args.take).toBe(2);
  expect(args.where.AND).toHaveLength(2);
  expect(result).toEqual({
    items: [{ id: 'one', filename: 'a.jpg', url: 'https://cdn/a.jpg' }],
    nextCursor: 'one',
  });
  await expect(service.listImages(undefined, 1000, '')).rejects.toThrow();
});
it('refuses ephemeral media fallback in production when S3 is incomplete', () => {
  const keys = [
    'NODE_ENV',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_S3_BUCKET',
    'AWS_REGION',
  ];
  const before = keys.map((key) => process.env[key]);
  try {
    for (const key of keys) delete process.env[key];
    process.env.NODE_ENV = 'production';
    expect(() => new MediaService({} as PrismaService)).toThrow('S3');
  } finally {
    keys.forEach((key, index) => {
      if (before[index] === undefined) delete process.env[key];
      else process.env[key] = before[index];
    });
  }
});
