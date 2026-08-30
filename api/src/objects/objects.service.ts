import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Ajv, { ValidateFunction } from 'ajv';
import { ObjectType } from './entities/object-type.entity';
import { ObjectEntity } from './entities/object.entity';
import { CreateObjectDto, UpdateObjectDto } from './dto/object.dto';

export interface ObjectRow {
  id: number;
  objectTypeId: number;
  typeCode: string;
  geometry: Record<string, unknown> | null;
  attrs: Record<string, unknown>;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const GEOJSON_TO_GEOMETRY_TYPE: Record<string, string> = {
  Point: 'point',
  MultiPoint: 'multipoint',
  LineString: 'linestring',
  MultiLineString: 'multilinestring',
  Polygon: 'polygon',
  MultiPolygon: 'multipolygon',
};

@Injectable()
export class ObjectsService {
  private readonly ajv = new Ajv({ allErrors: true, coerceTypes: false });
  private readonly validators = new Map<string, ValidateFunction>();

  constructor(
    @InjectRepository(ObjectEntity)
    private readonly objectsRepo: Repository<ObjectEntity>,
    @InjectRepository(ObjectType)
    private readonly typesRepo: Repository<ObjectType>,
  ) {}

  async list(
    typeCode: string,
    bbox?: string,
    limit = 1000,
    offset = 0,
  ): Promise<ObjectRow[]> {
    const type = await this.requireType(typeCode);

    const qb = this.objectsRepo
      .createQueryBuilder('o')
      .select([
        'o."id" AS id',
        'o."objectTypeId" AS "objectTypeId"',
        ':typeCode AS "typeCode"',
        'ST_AsGeoJSON(o.geometry)::jsonb AS geometry',
        'o.attrs AS attrs',
        'o."createdBy" AS "createdBy"',
        'o."updatedBy" AS "updatedBy"',
        'o."createdAt" AS "createdAt"',
        'o."updatedAt" AS "updatedAt"',
      ])
      .setParameter('typeCode', typeCode)
      .where('o."objectTypeId" = :typeId', { typeId: type.id })
      .limit(limit)
      .offset(offset);

    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      qb.andWhere(
        'o.geometry && ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326)',
        { minLon, minLat, maxLon, maxLat },
      );
    }

    const rows = await qb.getRawMany();
    return rows.map((r) => this.mapRow(r));
  }

  async getById(id: number): Promise<ObjectRow> {
    const row = await this.objectsRepo
      .createQueryBuilder('o')
      .select([
        'o."id" AS id',
        'o."objectTypeId" AS "objectTypeId"',
        't.code AS "typeCode"',
        'ST_AsGeoJSON(o.geometry)::jsonb AS geometry',
        'o.attrs AS attrs',
        'o."createdBy" AS "createdBy"',
        'o."updatedBy" AS "updatedBy"',
        'o."createdAt" AS "createdAt"',
        'o."updatedAt" AS "updatedAt"',
      ])
      .innerJoin('object_types', 't', 't.id = o."objectTypeId"')
      .where('o.id = :id', { id })
      .getRawOne();

    if (!row) {
      throw new NotFoundException(`object ${id} not found`);
    }
    return this.mapRow(row);
  }

  async create(dto: CreateObjectDto, userId: string): Promise<ObjectRow> {
    const type = await this.requireType(dto.type);
    this.validateGeometry(type, dto.geometry);
    this.validateAttrs(type, dto.attrs);

    const result = await this.objectsRepo.query(
      `INSERT INTO objects ("objectTypeId", geometry, attrs, "createdBy", "updatedBy")
       VALUES ($1, ST_GeomFromGeoJSON($2), $3, $4, $4)
       RETURNING id`,
      [type.id, JSON.stringify(dto.geometry), dto.attrs || {}, userId],
    );
    const id = Number(result[0]?.id);
    return this.getById(id);
  }

  async update(
    id: number,
    dto: UpdateObjectDto,
    userId: string,
  ): Promise<ObjectRow> {
    const existing = await this.getById(id);
    const type = await this.requireType(existing.typeCode);

    if (dto.geometry) {
      this.validateGeometry(type, dto.geometry);
    }
    if (dto.attrs !== undefined) {
      this.validateAttrs(type, { ...existing.attrs, ...dto.attrs });
    }

    const sets: string[] = ['"updatedBy" = $2'];
    const params: unknown[] = [id, userId];
    if (dto.geometry) {
      sets.push('geometry = ST_GeomFromGeoJSON($' + (params.length + 1) + ')');
      params.push(JSON.stringify(dto.geometry));
    }
    if (dto.attrs !== undefined) {
      sets.push('attrs = $' + (params.length + 1));
      params.push({ ...existing.attrs, ...dto.attrs });
    }

    await this.objectsRepo.query(
      `UPDATE objects SET ${sets.join(', ')} WHERE id = $1`,
      params,
    );
    return this.getById(id);
  }

  async remove(id: number): Promise<{ id: number }> {
    await this.getById(id);
    await this.objectsRepo.delete(id);
    return { id };
  }

  private async requireType(code: string): Promise<ObjectType> {
    const type = await this.typesRepo.findOne({ where: { code } });
    if (!type) {
      throw new NotFoundException(`object type '${code}' not found`);
    }
    return type;
  }

  private validateGeometry(type: ObjectType, geometry: { type: string }) {
    const expected = GEOJSON_TO_GEOMETRY_TYPE[geometry.type];
    if (!expected) {
      throw new BadRequestException(`unsupported GeoJSON type '${geometry.type}'`);
    }
    if (expected !== type.geometryType) {
      throw new BadRequestException(
        `type '${type.code}' expects ${type.geometryType}, got ${expected}`,
      );
    }
  }

  private validateAttrs(type: ObjectType, attrs: Record<string, unknown> = {}) {
    const schema = type.attrsSchema || {};
    if (!schema || Object.keys(schema).length === 0) {
      return;
    }
    const validate = this.getValidator(type.code, schema);
    if (!validate(attrs)) {
      const details = validate.errors?.map(
        (e) => `${e.instancePath || '/'} ${e.message}`,
      );
      throw new BadRequestException(
        `attrs validation failed: ${details?.join('; ')}`,
      );
    }
  }

  private getValidator(code: string, schema: unknown): ValidateFunction {
    let validate = this.validators.get(code);
    if (!validate) {
      validate = this.ajv.compile(schema as object);
      this.validators.set(code, validate);
    }
    return validate;
  }

  private mapRow(r: Record<string, unknown>): ObjectRow {
    return {
      id: Number(r.id),
      objectTypeId: Number(r.objectTypeId),
      typeCode: r.typeCode as string,
      geometry: (r.geometry as Record<string, unknown>) ?? null,
      attrs: (r.attrs as Record<string, unknown>) ?? {},
      createdBy: (r.createdBy as string) ?? null,
      updatedBy: (r.updatedBy as string) ?? null,
      createdAt: r.createdAt as Date,
      updatedAt: r.updatedAt as Date,
    };
  }
}
