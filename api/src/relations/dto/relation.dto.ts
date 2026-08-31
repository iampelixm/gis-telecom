import { Type } from 'class-transformer';
import { IsInt, IsObject, IsOptional, IsString, Matches, MinLength } from 'class-validator';

export class CreateRelationDto {
  @IsString()
  @MinLength(1)
  relationType: string;

  @Type(() => Number)
  @IsInt()
  fromId: number;

  @Type(() => Number)
  @IsInt()
  toId: number;

  @IsOptional()
  @IsObject()
  attrs?: Record<string, unknown>;
}

export class UpdateRelationDto {
  @IsOptional()
  @IsObject()
  attrs?: Record<string, unknown>;
}

export class ListRelationsQuery {
  @IsString()
  type: string;

  @IsOptional()
  @Matches(
    /^-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?,-?\d+(\.\d+)?$/,
    { message: 'bbox must be "minLon,minLat,maxLon,maxLat"' },
  )
  bbox?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  offset?: number;
}
