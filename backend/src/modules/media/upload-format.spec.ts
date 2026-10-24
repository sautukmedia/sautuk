import { BadRequestException } from '@nestjs/common';
import { validateUploadFormat } from './upload-format';
describe('media file verification', () => {
  it('rejects executable content disguised as an image', () => {
    expect(() => validateUploadFormat(Buffer.from('<script>alert(1)</script>'), 'image/png')).toThrow(BadRequestException);
  });
  it('rejects active SVG uploads', () => {
    expect(() => validateUploadFormat(Buffer.from('<svg onload="alert(1)"></svg>'), 'image/svg+xml')).toThrow(BadRequestException);
  });
  it('recognizes a PNG by its bytes rather than the supplied filename', () => {
    expect(validateUploadFormat(Buffer.from('89504e470d0a1a0a', 'hex'), 'image/png')).toEqual({ extension: '.png', mime: 'image/png', attachment: false });
  });
  it('marks documents for download', () => {
    expect(validateUploadFormat(Buffer.from('%PDF-1.7\n'), 'application/pdf')).toMatchObject({ extension: '.pdf', attachment: true });
  });
});
