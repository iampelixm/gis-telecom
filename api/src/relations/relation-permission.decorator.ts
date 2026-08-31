import { SetMetadata } from '@nestjs/common';

export const RELATION_PERMISSION_KEY = 'relation_permission';

export type RelationPermissionAction = 'read' | 'write';

export const RequireRelationPermission = (action: RelationPermissionAction) =>
  SetMetadata(RELATION_PERMISSION_KEY, action);
