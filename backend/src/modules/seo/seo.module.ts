import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { PostsModule } from '../posts/posts.module';
import { SeoController } from './seo.controller';
import { SeoService } from './seo.service';

@Module({
  imports: [PostsModule, AuthModule, JwtModule.register({})],
  providers: [SeoService],
  controllers: [SeoController],
})
export class SeoModule {}
