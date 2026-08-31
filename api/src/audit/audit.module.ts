import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeLog } from './entities/change-log.entity';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { HistoryPermissionGuard } from './history-permission.guard';

@Module({
  imports: [TypeOrmModule.forFeature([ChangeLog])],
  controllers: [AuditController],
  providers: [AuditService, HistoryPermissionGuard],
  exports: [AuditService],
})
export class AuditModule {}
