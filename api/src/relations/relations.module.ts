import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { ObjectEntity } from '../objects/entities/object.entity';
import { ObjectRelation } from '../objects/entities/object-relation.entity';
import { RelationType } from '../objects/entities/relation-type.entity';
import { RelationPermissionGuard } from './relation-permission.guard';
import { RelationsController } from './relations.controller';
import { RelationsService } from './relations.service';

@Module({
  imports: [TypeOrmModule.forFeature([ObjectRelation, RelationType, ObjectEntity]), AuditModule],
  controllers: [RelationsController],
  providers: [RelationsService, RelationPermissionGuard],
})
export class RelationsModule {}
