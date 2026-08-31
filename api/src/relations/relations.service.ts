import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ObjectRelation } from '../objects/entities/object-relation.entity';
import { RelationType } from '../objects/entities/relation-type.entity';
import { ObjectEntity } from '../objects/entities/object.entity';
import { CreateRelationDto, UpdateRelationDto } from './dto/relation.dto';

export interface RelationRow {
  id: number;
  relationTypeCode: string;
  fromId: number;
  toId: number;
  attrs: Record<string, unknown>;
  createdBy: string | null;
  createdAt: Date;
}

interface RelationDetailRow extends RelationRow {
  fromTypeCode: string;
  toTypeCode: string;
  from: Record<string, unknown> | null;
  to: Record<string, unknown> | null;
}

@Injectable()
export class RelationsService {
  constructor(
    @InjectRepository(ObjectRelation)
    private readonly relationsRepo: Repository<ObjectRelation>,
    @InjectRepository(RelationType)
    private readonly relationTypesRepo: Repository<RelationType>,
    @InjectRepository(ObjectEntity)
    private readonly objectsRepo: Repository<ObjectEntity>,
  ) {}

  async list(
    typeCode: string,
    bbox?: string,
    limit = 1000,
    offset = 0,
  ): Promise<Record<string, unknown>> {
    const type = await this.requireRelationType(typeCode);

    const qb = this.relationsRepo
      .createQueryBuilder('r')
      .select([
        'r."id" AS id',
        'rt.code AS "relationTypeCode"',
        'r."fromObjectId" AS "fromId"',
        'r."toObjectId" AS "toId"',
        'r.attrs AS attrs',
        'r."createdBy" AS "createdBy"',
        'r."createdAt" AS "createdAt"',
        'ST_AsGeoJSON(ST_Centroid(f.geometry))::jsonb AS "fromPoint"',
        'ST_AsGeoJSON(ST_Centroid(t.geometry))::jsonb AS "toPoint"',
      ])
      .innerJoin('relation_types', 'rt', 'rt.id = r."relationTypeId"')
      .innerJoin('objects', 'f', 'f.id = r."fromObjectId"')
      .innerJoin('objects', 't', 't.id = r."toObjectId"')
      .where('r."relationTypeId" = :typeId', { typeId: type.id })
      .limit(limit)
      .offset(offset);

    if (bbox) {
      const [minLon, minLat, maxLon, maxLat] = bbox.split(',').map(Number);
      qb.andWhere(
        '(f.geometry && ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326) ' +
          'OR t.geometry && ST_MakeEnvelope(:minLon, :minLat, :maxLon, :maxLat, 4326))',
        { minLon, minLat, maxLon, maxLat },
      );
    }

    const rows = await qb.getRawMany();
    return this.toFeatureCollection(rows);
  }

  async getById(id: number): Promise<RelationDetailRow> {
    const row = await this.relationsRepo
      .createQueryBuilder('r')
      .select([
        'r."id" AS id',
        'rt.code AS "relationTypeCode"',
        'r."relationTypeId" AS "relationTypeId"',
        'r."fromObjectId" AS "fromId"',
        'r."toObjectId" AS "toId"',
        'r.attrs AS attrs',
        'r."createdBy" AS "createdBy"',
        'r."createdAt" AS "createdAt"',
        'ft.code AS "fromTypeCode"',
        'tt.code AS "toTypeCode"',
        'ST_AsGeoJSON(f.geometry)::jsonb AS "from"',
        'ST_AsGeoJSON(t.geometry)::jsonb AS "to"',
      ])
      .innerJoin('relation_types', 'rt', 'rt.id = r."relationTypeId"')
      .innerJoin('object_types', 'ft', 'ft.id = rt."fromTypeId"')
      .innerJoin('object_types', 'tt', 'tt.id = rt."toTypeId"')
      .innerJoin('objects', 'f', 'f.id = r."fromObjectId"')
      .innerJoin('objects', 't', 't.id = r."toObjectId"')
      .where('r.id = :id', { id })
      .getRawOne();

    if (!row) {
      throw new NotFoundException(`relation ${id} not found`);
    }
    return this.mapDetailRow(row);
  }

  async create(dto: CreateRelationDto, userId: string): Promise<RelationDetailRow> {
    const type = await this.requireRelationType(dto.relationType);
    await this.validateEndpoints(type, dto.fromId, dto.toId);

    const result = await this.relationsRepo.query(
      `INSERT INTO "object_relations" ("relationTypeId", "fromObjectId", "toObjectId", attrs, "createdBy")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [type.id, dto.fromId, dto.toId, dto.attrs || {}, userId],
    );
    const id = Number(result[0]?.id);
    return this.getById(id);
  }

  async update(id: number, dto: UpdateRelationDto): Promise<RelationDetailRow> {
    const existing = await this.getById(id);
    await this.relationsRepo.query(
      `UPDATE "object_relations"
       SET attrs = $2
       WHERE id = $1`,
      [id, dto.attrs !== undefined ? dto.attrs : existing.attrs],
    );
    return this.getById(id);
  }

  async remove(id: number): Promise<{ id: number }> {
    await this.getById(id);
    await this.relationsRepo.delete(id);
    return { id };
  }

  private async requireRelationType(code: string): Promise<RelationType> {
    const type = await this.relationTypesRepo.findOne({ where: { code } });
    if (!type) {
      throw new NotFoundException(`relation type '${code}' not found`);
    }
    if (!type.isActive) {
      throw new BadRequestException(`relation type '${code}' is not active`);
    }
    return type;
  }

  private async validateEndpoints(
    type: RelationType,
    fromId: number,
    toId: number,
  ): Promise<void> {
    if (fromId === toId) {
      throw new BadRequestException('fromId and toId must be different objects');
    }
    const rows = await this.objectsRepo.query(
      `SELECT id, "objectTypeId"
       FROM objects
       WHERE id = ANY($1)
       ORDER BY id`,
      [[fromId, toId]],
    );
    if (rows.length !== 2) {
      throw new BadRequestException(`objects ${fromId}/${toId} not found`);
    }
    const typeById = new Map(rows.map((r: { id: number; objectTypeId: number }) => [Number(r.id), Number(r.objectTypeId)]));
    if (typeById.get(fromId) !== type.fromTypeId) {
      throw new BadRequestException(
        `object ${fromId} is not of type '${type.fromTypeId}' required by relation '${type.code}'`,
      );
    }
    if (typeById.get(toId) !== type.toTypeId) {
      throw new BadRequestException(
        `object ${toId} is not of type '${type.toTypeId}' required by relation '${type.code}'`,
      );
    }
  }

  private toFeatureCollection(
    rows: Array<Record<string, unknown>>,
  ): Record<string, unknown> {
    const features = rows
      .map((r) => {
        const from = r.fromPoint as Record<string, unknown> | null;
        const to = r.toPoint as Record<string, unknown> | null;
        if (!from?.coordinates || !to?.coordinates) {
          return null;
        }
        return {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [from.coordinates, to.coordinates],
          },
          properties: {
            id: Number(r.id),
            relationType: r.relationTypeCode as string,
            fromId: Number(r.fromId),
            toId: Number(r.toId),
            attrs: (r.attrs as Record<string, unknown>) ?? {},
          },
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    return { type: 'FeatureCollection', features };
  }

  private mapDetailRow(r: Record<string, unknown>): RelationDetailRow {
    return {
      id: Number(r.id),
      relationTypeCode: r.relationTypeCode as string,
      fromId: Number(r.fromId),
      toId: Number(r.toId),
      attrs: (r.attrs as Record<string, unknown>) ?? {},
      createdBy: (r.createdBy as string) ?? null,
      createdAt: r.createdAt as Date,
      fromTypeCode: r.fromTypeCode as string,
      toTypeCode: r.toTypeCode as string,
      from: (r.from as Record<string, unknown>) ?? null,
      to: (r.to as Record<string, unknown>) ?? null,
    };
  }
}
