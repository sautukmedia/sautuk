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

      if (!existingUser) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);
        await this.prisma.user.create({
          data: {
            email: adminEmail,
            passwordHash,
            role: Role.ADMIN,
          },
        });
        console.log(`✅ Admin user ${adminEmail} created successfully on startup.`);
      } else {
        const shouldForceReset = process.env.RESET_ADMIN_CREDENTIALS === 'true';
        const missingPassword = !existingUser.passwordHash;

        if (shouldForceReset || missingPassword) {
          const passwordHash = await bcrypt.hash(adminPassword, 10);
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: {
              passwordHash,
              role: Role.ADMIN,
            },
          });
          console.log(`✅ Admin user ${adminEmail} password reset/initialized on startup.`);
        } else if (existingUser.role !== Role.ADMIN) {
          await this.prisma.user.update({
            where: { id: existingUser.id },
            data: { role: Role.ADMIN },
          });
          console.log(`✅ Admin user ${adminEmail} role verified on startup.`);
        } else {
          console.log(`✅ Admin user ${adminEmail} verified (custom password preserved).`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to seed or sync admin user on startup:', error);
    }
  }
}
