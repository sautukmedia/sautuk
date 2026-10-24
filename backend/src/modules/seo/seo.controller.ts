import {
  Controller,
  Get,
  Header,
  Param,
  ParseIntPipe,
  Res,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { SeoService } from './seo.service';
import { PublicCacheInterceptor } from '../../common/interceptors/public-cache.interceptor';

@Controller('seo')
@UseInterceptors(PublicCacheInterceptor)
export class SeoController {
  constructor(private readonly seo: SeoService) {}
  @Get('home')
  @Header('Cache-Control', 'no-store')
  home() {
    return this.seo.home();
  }
  @Get('articles/:slug')
  @Header('Cache-Control', 'no-store')
  article(@Param('slug') slug: string) {
    return this.seo.article(slug);
  }
  @Get('sitemap.xml')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  sitemap() {
    return this.seo.sitemapIndex();
  }
  @Get('sitemaps/pages.xml')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  pages() {
    return this.seo.sitemapPages();
  }
  @Get('sitemaps/articles-:page.xml')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  sitemapPage(@Param('page', ParseIntPipe) page: number) {
    return this.seo.sitemapPage(page);
  }
  @Get('robots.txt')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  robots() {
    return this.seo.robots();
  }
  @Get('llms.txt')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  llms() {
    return this.seo.llms();
  }
  @Get('feed.xml')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'application/rss+xml; charset=utf-8')
  rss() {
    return this.seo.rss();
  }
  @Get('feed.json')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'application/feed+json; charset=utf-8')
  jsonFeed() {
    return this.seo.jsonFeed();
  }
  @Get('article-text/:slug')
  @Header('Cache-Control', 'no-store')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async text(
    @Param('slug') slug: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const page = await this.seo.text(slug);
    response.setHeader('Link', `<${page.canonical}>; rel="canonical"`);
    return page.text;
  }
}
