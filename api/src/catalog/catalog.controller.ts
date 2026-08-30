import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/permissions.decorator';
import { CatalogService } from './catalog.service';
import {
  CreateLayerDto,
  CreateObjectTypeDto,
  CreateRelationTypeDto,
  UpdateLayerDto,
  UpdateObjectTypeDto,
  UpdateRelationTypeDto,
} from './dto/catalog.dto';

@Controller('catalog')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('object-types:manage')
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('layers')
  listLayers() {
    return this.catalogService.listLayers();
  }

  @Post('layers')
  createLayer(@Body() dto: CreateLayerDto) {
    return this.catalogService.createLayer(dto);
  }

  @Patch('layers/:id')
  updateLayer(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLayerDto) {
    return this.catalogService.updateLayer(id, dto);
  }

  @Delete('layers/:id')
  removeLayer(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.removeLayer(id);
  }

  @Get('object-types')
  listObjectTypes() {
    return this.catalogService.listObjectTypes();
  }

  @Post('object-types')
  createObjectType(@Body() dto: CreateObjectTypeDto) {
    return this.catalogService.createObjectType(dto);
  }

  @Patch('object-types/:id')
  updateObjectType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateObjectTypeDto,
  ) {
    return this.catalogService.updateObjectType(id, dto);
  }

  @Delete('object-types/:id')
  removeObjectType(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.removeObjectType(id);
  }

  @Get('relation-types')
  listRelationTypes() {
    return this.catalogService.listRelationTypes();
  }

  @Post('relation-types')
  createRelationType(@Body() dto: CreateRelationTypeDto) {
    return this.catalogService.createRelationType(dto);
  }

  @Patch('relation-types/:id')
  updateRelationType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRelationTypeDto,
  ) {
    return this.catalogService.updateRelationType(id, dto);
  }

  @Delete('relation-types/:id')
  removeRelationType(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.removeRelationType(id);
  }
}
