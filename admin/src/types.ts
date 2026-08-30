export interface JwtUser {
  sub: string;
  name: string;
  role: string;
  permissions: string[];
}

export interface Layer {
  id: number;
  code: string;
  name: string;
  color: string | null;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ObjectType {
  id: number;
  code: string;
  name: string;
  layerId: number | null;
  geometryType: 'point' | 'linestring' | 'polygon' | 'multipoint' | 'multilinestring' | 'multipolygon';
  color: string | null;
  icon: string | null;
  lineWidth: number | null;
  attrsSchema: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RelationType {
  id: number;
  code: string;
  name: string;
  fromTypeId: number;
  toTypeId: number;
  isActive: boolean;
  createdAt: string;
  fromType?: ObjectType;
  toType?: ObjectType;
}

export const GEOMETRY_TYPES = [
  'point',
  'linestring',
  'polygon',
  'multipoint',
  'multilinestring',
  'multipolygon',
] as const;
