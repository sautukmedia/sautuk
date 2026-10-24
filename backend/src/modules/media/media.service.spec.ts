import { MediaService } from './media.service';
import type { PrismaService } from '../../prisma/prisma.service';
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
