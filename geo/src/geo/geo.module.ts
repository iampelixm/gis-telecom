import { Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';

@Module({
  controllers: [GeoController],
  providers: [GeoService, CacheService],
})
export class GeoModule {}
