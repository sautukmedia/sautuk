import { Controller, Post, Body } from '@nestjs/common';
import { SubscribersService } from './subscribers.service';
import { SubscribeDto } from './dto/subscribe.dto';

@Controller('subscribers')
export class SubscribersController {
  constructor(private readonly subscribersService: SubscribersService) {}

  @Post()
  async subscribe(@Body() body: SubscribeDto) {
    return this.subscribersService.subscribe(body.email);
  }
}
