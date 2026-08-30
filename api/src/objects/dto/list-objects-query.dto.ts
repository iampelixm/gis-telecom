import { IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListObjectsQuery {
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
  @Min(1)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
