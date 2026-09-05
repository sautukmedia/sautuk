import { Controller, Post, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { SubscribersService } from './subscribers.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Controller('subscribers')
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post()
  async subscribe(@Body() body: SubscribeDto) {
    return this.subscribersService.subscribe(body.email);
  }
}
