import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuditService } from './audit.service';
import { HistoryPermissionGuard } from './history-permission.guard';

@Controller('history')
@UseGuards(JwtAuthGuard, HistoryPermissionGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  byEntity(
    @Query('entityType') entityType: 'object' | 'relation',
    @Query('entityId') entityId: string,
  ) {
    return this.auditService.findByEntity(
      entityType,
      Number(entityId),
    );
  }
}
