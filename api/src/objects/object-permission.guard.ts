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
import { ObjectType } from './entities/object-type.entity';
import { ObjectEntity } from './entities/object.entity';
import { OBJECT_PERMISSION_KEY, ObjectPermissionAction } from './object-permission.decorator';

@Injectable()
export class ObjectPermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(ObjectEntity)
    private readonly objectsRepo: Repository<ObjectEntity>,
    @InjectRepository(ObjectType)
    private readonly typesRepo: Repository<ObjectType>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const action = this.reflector.getAllAndOverride<ObjectPermissionAction>(OBJECT_PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

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
      throw new ForbiddenException('unable to determine object type');
    }

    const permissions: string[] = user.permissions || [];
    const required = `objects:${typeCode}:${action}`;
    if (permissions.includes('*') || permissions.includes(required)) {
      return true;
    }
    throw new ForbiddenException(`insufficient permissions: ${required}`);
  }

  private async resolveTypeCode(request: any): Promise<string | null> {
    if (request.query?.type) {
      return request.query.type as string;
    }
    if (request.body?.type) {
      return request.body.type as string;
    }
    if (request.params?.id) {
      const object = await this.objectsRepo.findOne({
        where: { id: Number(request.params.id) },
      });
      if (!object) {
        throw new NotFoundException(`object ${request.params.id} not found`);
      }
      const type = await this.typesRepo.findOne({
        where: { id: object.objectTypeId },
      });
      return type?.code ?? null;
    }
    return null;
  }
}
