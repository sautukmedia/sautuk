import { BadRequestException } from '@nestjs/common';

export function validateUploadFormat(bytes: Buffer, declaredType: string) {
  const formats = [
    {
      mime: 'image/png',
      extension: '.png',
      attachment: false,
      matches: bytes
        .subarray(0, 8)
        .equals(Buffer.from('89504e470d0a1a0a', 'hex')),
    },
    {
      mime: 'image/jpeg',
      extension: '.jpg',
      attachment: false,
      matches: bytes.subarray(0, 3).equals(Buffer.from('ffd8ff', 'hex')),
    },
    {
      mime: 'image/gif',
      extension: '.gif',
      attachment: false,
      matches: /^GIF8[79]a$/.test(bytes.subarray(0, 6).toString('ascii')),
    },
    {
      mime: 'image/webp',
      extension: '.webp',
      attachment: false,
      matches:
        bytes.subarray(0, 4).toString() === 'RIFF' &&
        bytes.subarray(8, 12).toString() === 'WEBP',
    },
    {
      mime: 'application/pdf',
      extension: '.pdf',
      attachment: true,
      matches: bytes.subarray(0, 5).toString() === '%PDF-',
    },
    {
      mime: 'application/msword',
      extension: '.doc',
      attachment: true,
      matches: bytes
        .subarray(0, 8)
        .equals(Buffer.from('d0cf11e0a1b11e1', 'hex')),
    },
    {
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: '.docx',
      attachment: true,
      matches: bytes.subarray(0, 4).equals(Buffer.from('504b0304', 'hex')),
    },
  ];
  const format = formats.find(
    (item) => item.mime === declaredType.toLowerCase() && item.matches,
  );
  if (!format)
    throw new BadRequestException(
      'Unsupported or mismatched file content. Upload a PNG, JPEG, GIF, WebP, PDF, or Word document.',
    );
  const { mime, extension, attachment } = format;
  return { mime, extension, attachment };
}
