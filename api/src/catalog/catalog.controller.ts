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
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Get('layers')
  listLayers() {
    return this.catalogService.listLayers();
  }

  @Get('object-types')
  listObjectTypes() {
    return this.catalogService.listObjectTypes();
  }

  @Get('relation-types')
  listRelationTypes() {
    return this.catalogService.listRelationTypes();
  }

  @Post('layers')
  @RequirePermissions('object-types:manage')
  createLayer(@Body() dto: CreateLayerDto) {
    return this.catalogService.createLayer(dto);
  }

  @Patch('layers/:id')
  @RequirePermissions('object-types:manage')
  updateLayer(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLayerDto) {
    return this.catalogService.updateLayer(id, dto);
  }

  @Delete('layers/:id')
  @RequirePermissions('object-types:manage')
  removeLayer(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.removeLayer(id);
  }

  @Post('object-types')
  @RequirePermissions('object-types:manage')
  createObjectType(@Body() dto: CreateObjectTypeDto) {
    return this.catalogService.createObjectType(dto);
  }

  @Patch('object-types/:id')
  @RequirePermissions('object-types:manage')
  updateObjectType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateObjectTypeDto,
  ) {
    return this.catalogService.updateObjectType(id, dto);
  }

  @Delete('object-types/:id')
  @RequirePermissions('object-types:manage')
  removeObjectType(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.removeObjectType(id);
  }

  @Post('relation-types')
  @RequirePermissions('object-types:manage')
  createRelationType(@Body() dto: CreateRelationTypeDto) {
    return this.catalogService.createRelationType(dto);
  }

  @Patch('relation-types/:id')
  @RequirePermissions('object-types:manage')
  updateRelationType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRelationTypeDto,
  ) {
    return this.catalogService.updateRelationType(id, dto);
  }

  @Delete('relation-types/:id')
  @RequirePermissions('object-types:manage')
  removeRelationType(@Param('id', ParseIntPipe) id: number) {
    return this.catalogService.removeRelationType(id);
  }
}
