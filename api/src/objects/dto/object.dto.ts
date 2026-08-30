import { Type } from 'class-transformer';
import {
  IsDefined,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class GeoJsonDto {
  @IsString()
  type: string;

  @IsDefined()
  coordinates: unknown;
}

export class CreateObjectDto {
  @IsString()
  @MinLength(1)
  type: string;

  @ValidateNested()
  @Type(() => GeoJsonDto)
  geometry: GeoJsonDto;

  @IsOptional()
  @IsObject()
  attrs?: Record<string, unknown>;
}

export class UpdateObjectDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoJsonDto)
  geometry?: GeoJsonDto;

  @IsOptional()
  @IsObject()
  attrs?: Record<string, unknown>;
}
