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
import { RelationPermissionGuard } from './relation-permission.guard';
import { RequireRelationPermission } from './relation-permission.decorator';
import { CreateRelationDto, ListRelationsQuery, UpdateRelationDto } from './dto/relation.dto';
import { RelationsService } from './relations.service';
import { AuditService } from '../audit/audit.service';

@Controller('relations')
@UseGuards(JwtAuthGuard, RelationPermissionGuard)
export class RelationsController {
  constructor(
    private readonly relationsService: RelationsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @RequireRelationPermission('read')
  list(@Query() query: ListRelationsQuery) {
    return this.relationsService.list(
      query.type,
      query.bbox,
      query.limit,
      query.offset,
    );
  }

  @Get(':id/history')
  @RequireRelationPermission('read')
  history(@Param('id', ParseIntPipe) id: number) {
    return this.auditService.findByEntity('relation', id);
  }

  @Get(':id')
  @RequireRelationPermission('read')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.relationsService.getById(id);
  }

  @Post()
  @RequireRelationPermission('write')
  create(
    @Body() dto: CreateRelationDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.relationsService.create(dto, req.user.sub);
  }

  @Patch(':id')
  @RequireRelationPermission('write')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRelationDto,
    @Request() req: { user: { sub: string } },
  ) {
    return this.relationsService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @RequireRelationPermission('write')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req: { user: { sub: string } },
  ) {
    return this.relationsService.remove(id, req.user.sub);
  }
}
