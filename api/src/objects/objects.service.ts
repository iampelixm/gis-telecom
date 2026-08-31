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
import { AuditService } from '../audit/audit.service';

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
    private readonly auditService: AuditService,
  ) {}

  async list(
    typeCode: string,
    bbox?: string,
    limit = 1000,
    offset = 0,
    search?: string,
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

    if (search && search.trim()) {
      const needle = `%${search.trim()}%`;
      qb.andWhere(
        '(o.attrs::text ILIKE :search OR o."id"::text = :idMatch)',
        { search: needle, idMatch: search.trim() },
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
    const created = await this.getById(id);
    await this.auditService.log({
      entityType: 'object',
      entityId: id,
      typeCode: type.code,
      action: 'created',
      actor: userId,
      changes: { attrs: dto.attrs || {}, geometry: dto.geometry },
    });
    return created;
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
    const updated = await this.getById(id);

    if (dto.geometry) {
      await this.auditService.log({
        entityType: 'object',
        entityId: id,
        typeCode: existing.typeCode,
        action: 'moved',
        actor: userId,
        changes: {
          geometry: {
            before: existing.geometry,
            after: updated.geometry,
          },
        },
      });
    }
    if (dto.attrs !== undefined) {
      const before = existing.attrs;
      const after = updated.attrs;
      const changed = this.diffAttrs(before, after);
      if (Object.keys(changed).length > 0) {
        await this.auditService.log({
          entityType: 'object',
          entityId: id,
          typeCode: existing.typeCode,
          action: 'updated',
          actor: userId,
          changes: { attrs: changed },
        });
      }
    }

    return updated;
  }

  async remove(id: number, userId: string): Promise<{ id: number }> {
    const existing = await this.getById(id);
    await this.objectsRepo.delete(id);
    await this.auditService.log({
      entityType: 'object',
      entityId: id,
      typeCode: existing.typeCode,
      action: 'deleted',
      actor: userId,
      changes: {
        attrs: existing.attrs,
        geometry: existing.geometry,
        typeCode: existing.typeCode,
      },
    });
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

  private diffAttrs(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): Record<string, { before: unknown; after: unknown }> {
    const keys = new Set([
      ...Object.keys(before || {}),
      ...Object.keys(after || {}),
    ]);
    const changed: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of keys) {
      const b = before?.[key];
      const a = after?.[key];
      if (JSON.stringify(b) !== JSON.stringify(a)) {
        changed[key] = { before: b ?? null, after: a ?? null };
      }
    }
    return changed;
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
