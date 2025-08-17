import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SubscribersService {
  constructor(private readonly prisma: PrismaService) {}

  async subscribe(email: string) {
    const lowerEmail = email.toLowerCase().trim();
    
    const existing = await this.prisma.subscriber.findUnique({
      where: { email: lowerEmail },
    });

    if (existing) {
      return { message: 'You are already subscribed to our newsletter.', success: true };
    }

    await this.prisma.subscriber.create({
      data: { email: lowerEmail },
    });

    return { message: 'Thank you for subscribing to Sautuk Media!', success: true };
  }
}
