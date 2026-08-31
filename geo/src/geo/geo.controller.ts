import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { GeoService } from './geo.service';

@Controller()
export class GeoController {
  constructor(private readonly geo: GeoService) {}

  @Get('health')
  health() {
    return { status: 'ok' };
  }

  @Get('suggest')
  @UseGuards(AuthGuard('jwt'))
  async suggest(@Query('query') query = '') {
    return this.geo.suggest(query);
  }

  @Get('forward')
  @UseGuards(AuthGuard('jwt'))
  async forward(@Query('address') address = '') {
    const result = await this.geo.forward(address);
    if (!result) {
      throw new HttpException('address not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('reverse')
  @UseGuards(AuthGuard('jwt'))
  async reverse(@Query('lat') lat = '', @Query('lon') lon = '') {
    const nLat = Number(lat);
    const nLon = Number(lon);
    if (!Number.isFinite(nLat) || !Number.isFinite(nLon)) {
      throw new HttpException('invalid lat/lon', HttpStatus.BAD_REQUEST);
    }
    const result = await this.geo.reverse(nLat, nLon);
    if (!result) {
      throw new HttpException('not found', HttpStatus.NOT_FOUND);
    }
    return result;
  }

  @Get('company')
  @UseGuards(AuthGuard('jwt'))
  async company(@Query('query') query = '') {
    return this.geo.company(query);
  }
}
