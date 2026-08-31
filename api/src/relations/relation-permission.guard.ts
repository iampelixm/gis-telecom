import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RelationType } from '../objects/entities/relation-type.entity';
import { ObjectRelation } from '../objects/entities/object-relation.entity';
import {
  RELATION_PERMISSION_KEY,
  RelationPermissionAction,
} from './relation-permission.decorator';

@Injectable()
export class RelationPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(RelationType)
    private readonly relationTypesRepo: Repository<RelationType>,
    @InjectRepository(ObjectRelation)
    private readonly relationsRepo: Repository<ObjectRelation>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<RelationPermissionAction>(
      RELATION_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!action) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new ForbiddenException('no authenticated user');
    }

    const typeCode = await this.resolveTypeCode(request);
    if (!typeCode) {
      throw new ForbiddenException('unable to determine relation type');
    }

    const permissions: string[] = user.permissions || [];
    const required = `object-relations:${typeCode}:${action}`;
    if (permissions.includes('*') || permissions.includes(required)) {
      return true;
    }
    throw new ForbiddenException(`insufficient permissions: ${required}`);
  }

  private async resolveTypeCode(request: any): Promise<string | null> {
    if (request.query?.type) {
      return request.query.type as string;
    }
    if (request.body?.relationType) {
      return request.body.relationType as string;
    }
    if (request.params?.id) {
      const relation = await this.relationsRepo.findOne({
        where: { id: Number(request.params.id) },
      });
      if (!relation) {
        throw new NotFoundException(`relation ${request.params.id} not found`);
      }
      const type = await this.relationTypesRepo.findOne({
        where: { id: relation.relationTypeId },
      });
      return type?.code ?? null;
    }
    return null;
  }
}
