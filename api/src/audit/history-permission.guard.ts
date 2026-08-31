import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChangeLog } from './entities/change-log.entity';

@Injectable()
export class HistoryPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(ChangeLog)
    private readonly changeLogRepo: Repository<ChangeLog>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('no authenticated user');
    }

    const entityType = request.query?.entityType as string | undefined;
    const entityId = Number(request.query?.entityId);
    if (!entityType || !Number.isFinite(entityId)) {
      throw new ForbiddenException('entityType and entityId are required');
    }

    const latest = await this.changeLogRepo
      .createQueryBuilder('cl')
      .select('cl.typeCode', 'typeCode')
      .where('cl."entityType" = :entityType', { entityType })
      .andWhere('cl."entityId" = :entityId', { entityId })
      .orderBy('cl.id', 'DESC')
      .getRawOne();

    if (!latest) {
      return true;
    }

    const prefix =
      entityType === 'relation' ? 'object-relations' : 'objects';
    const permissions: string[] = user.permissions || [];
    const required = `${prefix}:${latest.typeCode}:read`;
    if (permissions.includes('*') || permissions.includes(required)) {
      return true;
    }
    throw new ForbiddenException(`insufficient permissions: ${required}`);
  }
}
