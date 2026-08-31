import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ObjectPermissionGuard } from './object-permission.guard';
import { RequireObjectPermission } from './object-permission.decorator';
import { CreateObjectDto, UpdateObjectDto } from './dto/object.dto';
import { ListObjectsQuery } from './dto/list-objects-query.dto';
import { ObjectsService } from './objects.service';
import { AuditService } from '../audit/audit.service';

@Controller('objects')
@UseGuards(JwtAuthGuard, ObjectPermissionGuard)
export class ObjectsController {
  constructor(
    private readonly objectsService: ObjectsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequireObjectPermission('read')
  list(@Query() query: ListObjectsQuery) {
    return this.objectsService.list(
      query.type,
      query.bbox,
      query.limit,
      query.offset,
      query.search,
    );
  }

  @Get(':id/history')
  @RequireObjectPermission('read')
  history(@Param('id', ParseIntPipe) id: number) {
    return this.auditService.findByEntity('object', id);
  }

  @Get(':id')
  @RequireObjectPermission('read')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.objectsService.getById(id);
  }

  @Post()
  @RequireObjectPermission('write')
  create(
    @Body() dto: CreateObjectDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.objectsService.create(dto, req.user.sub);
  }

  @Patch(':id')
  @RequireObjectPermission('write')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateObjectDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.objectsService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @RequireObjectPermission('write')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { sub: string } },
  ) {
    return this.objectsService.remove(id, req.user.sub);
  }
}
