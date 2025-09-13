import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

@Injectable()
export class AppService implements OnApplicationBootstrap {
  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    await this.seedAdminUser();
  }

  getHello(): string {
    return 'Hello World!';
  }

  private async seedAdminUser() {
    const adminEmail = (process.env.ADMIN_EMAIL ?? 'admin@sautuk.com').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      console.warn('⚠️ ADMIN_PASSWORD env variable is not set. Skipping admin user sync/seed.');
      return;
    }

    try {
      console.log(`🌱 Checking/Syncing admin user: ${adminEmail}`);
      const existingUser = await this.prisma.user.findUnique({
        where: { email: adminEmail },
      });

      const passwordHash = await bcrypt.hash(adminPassword, 10);

      if (!existingUser) {
        await this.prisma.user.create({
          data: {
            email: adminEmail,
            passwordHash,
            role: Role.ADMIN,
          },
        });
        console.log(`✅ Admin user ${adminEmail} created successfully on startup.`);
      } else {
        await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            passwordHash,
            role: Role.ADMIN,
          },
        });
        console.log(`✅ Admin user ${adminEmail} credentials updated/synchronized on startup.`);
      }
    } catch (error) {
      console.error('❌ Failed to seed or sync admin user on startup:', error);
    }
  }
}
