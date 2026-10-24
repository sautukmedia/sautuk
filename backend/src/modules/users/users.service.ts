import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role, User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async create(data: { email: string; passwordHash?: string | null; role?: Role }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash || null,
        role: data.role || Role.READER,
      },
    });
  }

  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  async revokeSessions(id: string): Promise<void> {
    // Advance atomically even when two logouts happen within the same millisecond.
    await this.prisma.$executeRaw`UPDATE "User" SET "updatedAt" = GREATEST(date_trunc('milliseconds', clock_timestamp()), "updatedAt" + interval '1 millisecond') WHERE id = ${id}`;
  }
}
