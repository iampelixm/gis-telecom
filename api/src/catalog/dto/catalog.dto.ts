import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class CreateLayerDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be hex like #rrggbb' })
  color?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateLayerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be hex like #rrggbb' })
  color?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateObjectTypeDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsInt()
  layerId?: number | null;

  @IsString()
  geometryType: 'point' | 'linestring' | 'polygon' | 'multipoint' | 'multilinestring' | 'multipolygon';

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be hex like #rrggbb' })
  color?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsInt()
  lineWidth?: number | null;

  @IsOptional()
  @IsObject()
  attrsSchema?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateObjectTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  layerId?: number | null;

  @IsOptional()
  @IsString()
  geometryType?: 'point' | 'linestring' | 'polygon' | 'multipoint' | 'multilinestring' | 'multipolygon';

  @IsOptional()
  @IsString()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color must be hex like #rrggbb' })
  color?: string | null;

  @IsOptional()
  @IsString()
  icon?: string | null;

  @IsOptional()
  @IsInt()
  lineWidth?: number | null;

  @IsOptional()
  @IsObject()
  attrsSchema?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateRelationTypeDto {
  @IsString()
  @MinLength(1)
  code: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsInt()
  fromTypeId: number;

  @IsInt()
  toTypeId: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateRelationTypeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsInt()
  fromTypeId?: number;

  @IsOptional()
  @IsInt()
  toTypeId?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
