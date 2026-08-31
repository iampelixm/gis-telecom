import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChangeLog,
  ChangeLogAction,
  ChangeLogEntityType,
} from './entities/change-log.entity';

export interface ChangeLogRow {
  id: number;
  entityType: ChangeLogEntityType;
  entityId: number;
  typeCode: string;
  action: ChangeLogAction;
  actor: string | null;
  changes: Record<string, unknown> | null;
  createdAt: Date;
}

export interface LogEntryInput {
  entityType: ChangeLogEntityType;
  entityId: number;
  typeCode: string;
  action: ChangeLogAction;
  actor?: string | null;
  changes?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(ChangeLog)
    private readonly changeLogRepo: Repository<ChangeLog>,
  ) {}

  async log(entry: LogEntryInput): Promise<ChangeLogRow> {
    const saved = await this.changeLogRepo.save(
      this.changeLogRepo.create({
        entityType: entry.entityType,
        entityId: entry.entityId,
        typeCode: entry.typeCode,
        action: entry.action,
        actor: entry.actor ?? null,
        changes: entry.changes ?? null,
      }),
    );
    return this.mapRow(saved);
  }

  async findByEntity(
    entityType: ChangeLogEntityType,
    entityId: number,
    limit = 100,
  ): Promise<ChangeLogRow[]> {
    const rows = await this.changeLogRepo.find({
      where: { entityType, entityId },
      order: { id: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.mapRow(r));
  }

  async findByEntityId(entityId: number): Promise<ChangeLogRow[]> {
    const rows = await this.changeLogRepo.find({
      where: { entityId },
      order: { id: 'DESC' },
    });
    return rows.map((r) => this.mapRow(r));
  }

  private mapRow(r: ChangeLog): ChangeLogRow {
    return {
      id: r.id,
      entityType: r.entityType,
      entityId: r.entityId,
      typeCode: r.typeCode,
      action: r.action,
      actor: r.actor,
      changes: (r.changes as Record<string, unknown>) ?? null,
      createdAt: r.createdAt,
    };
  }
}
