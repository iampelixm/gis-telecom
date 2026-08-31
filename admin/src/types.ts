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

export interface MapObject {
  id: number;
  objectTypeId: number;
  typeCode: string;
  geometry: Record<string, unknown> | null;
  attrs: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RelationProperties {
  id: number;
  relationType: string;
  fromId: number;
  toId: number;
  attrs: Record<string, unknown>;
}

export interface RelationFeature {
  type: 'Feature';
  geometry: Record<string, unknown>;
  properties: RelationProperties;
}

export interface RelationFeatureCollection {
  type: 'FeatureCollection';
  features: RelationFeature[];
}
