import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class MediaService {
  private s3Client: S3Client | null = null;
  private bucketName: string | null = null;
  private region: string | null = null;

  constructor(private readonly prisma: PrismaService) {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const bucket = process.env.AWS_S3_BUCKET;
    const region = process.env.AWS_REGION;

    if (accessKeyId && secretAccessKey && bucket && region) {
      this.bucketName = bucket;
      this.region = region;
      this.s3Client = new S3Client({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      console.log('🌲 S3 Client initialized successfully for media uploads.');
    } else {
      console.warn('⚠️ AWS S3 environment variables are incomplete. Serving media uploads via local fallback.');
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<any> {
    const fileExtension = path.extname(file.originalname);
    const uniqueFilename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}${fileExtension}`;
    const s3Key = `sautuk/${uniqueFilename}`;

    if (this.s3Client && this.bucketName && this.region) {
      // S3 upload flow
      try {
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: s3Key,
          Body: file.buffer,
          ContentType: file.mimetype,
        });

        await this.s3Client.send(command);

        // Standard S3 URL
        const s3Url = `https://${this.bucketName}.s3.${this.region}.amazonaws.com/${s3Key}`;
        
        // If CloudFront URL is provided, map to it, otherwise fallback to S3 URL
        const cloudfrontBase = process.env.CLOUDFRONT_URL;
        const finalUrl = cloudfrontBase 
          ? `${cloudfrontBase.replace(/\/$/, '')}/${s3Key}`
          : s3Url;

        // Save media record to DB
        const mediaRecord = await this.prisma.media.create({
          data: {
            filename: file.originalname,
            s3Url: s3Url,
            cloudfrontUrl: finalUrl,
          },
        });

        return {
          id: mediaRecord.id,
          filename: mediaRecord.filename,
          url: finalUrl,
        };
      } catch (error) {
        console.error('❌ AWS S3 Upload failed:', error);
        throw new InternalServerErrorException('AWS S3 Upload failed: ' + (error as Error).message);
      }
    } else {
      // Local fallback upload flow (Development/Testing)
      try {
        const uploadDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        const filePath = path.join(uploadDir, uniqueFilename);
        fs.writeFileSync(filePath, file.buffer);

        // Build local endpoint access URL
        const port = process.env.PORT ?? 3000;
        const apiBaseUrl = process.env.NODE_ENV === 'production' 
          ? `https://sautuk-api.onrender.com` 
          : `http://localhost:${port}`;

        const localUrl = `${apiBaseUrl}/media/file/${uniqueFilename}`;

        // Save media record to DB
        const mediaRecord = await this.prisma.media.create({
          data: {
            filename: file.originalname,
            s3Url: localUrl,
            cloudfrontUrl: localUrl,
          },
        });

        return {
          id: mediaRecord.id,
          filename: mediaRecord.filename,
          url: localUrl,
        };
      } catch (error) {
        console.error('❌ Local Storage Upload failed:', error);
        throw new InternalServerErrorException('Local Storage Upload failed: ' + (error as Error).message);
      }
    }
  }
}
