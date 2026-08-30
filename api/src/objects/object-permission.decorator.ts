import { SetMetadata } from '@nestjs/common';

export const OBJECT_PERMISSION_KEY = 'object_permission';

export type ObjectPermissionAction = 'read' | 'write';

export const RequireObjectPermission = (action: ObjectPermissionAction) =>
  SetMetadata(OBJECT_PERMISSION_KEY, action);
