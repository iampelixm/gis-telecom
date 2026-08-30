import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository } from 'typeorm';
import { Layer } from '../objects/entities/layer.entity';
import { ObjectType } from '../objects/entities/object-type.entity';
import { RelationType } from '../objects/entities/relation-type.entity';
import {
  CreateLayerDto,
  CreateObjectTypeDto,
  CreateRelationTypeDto,
  UpdateLayerDto,
  UpdateObjectTypeDto,
  UpdateRelationTypeDto,
} from './dto/catalog.dto';

@Injectable()
export class CatalogService {
  constructor(
    @InjectRepository(Layer)
    private readonly layersRepo: Repository<Layer>,
    @InjectRepository(ObjectType)
    private readonly typesRepo: Repository<ObjectType>,
    @InjectRepository(RelationType)
    private readonly relationsRepo: Repository<RelationType>,
  ) {}

  async listLayers(): Promise<Layer[]> {
    return this.layersRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async createLayer(dto: CreateLayerDto): Promise<Layer> {
    return this.save(this.layersRepo, this.layersRepo.create(dto));
  }

  async updateLayer(id: number, dto: UpdateLayerDto): Promise<Layer> {
    await this.requireLayer(id);
    await this.save(this.layersRepo, { id, ...dto });
    return this.requireLayer(id);
  }

  async removeLayer(id: number): Promise<{ id: number }> {
    await this.requireLayer(id);
    await this.layersRepo.delete(id);
    return { id };
  }

  async listObjectTypes(): Promise<ObjectType[]> {
    return this.typesRepo.find({ order: { sortOrder: 'ASC' } });
  }

  async createObjectType(dto: CreateObjectTypeDto): Promise<ObjectType> {
    return this.save(this.typesRepo, this.typesRepo.create(dto));
  }

  async updateObjectType(
    id: number,
    dto: UpdateObjectTypeDto,
  ): Promise<ObjectType> {
    await this.requireType(id);
    await this.save(this.typesRepo, { id, ...dto });
    return this.requireType(id);
  }

  async removeObjectType(id: number): Promise<{ id: number }> {
    await this.requireType(id);
    await this.typesRepo.delete(id);
    return { id };
  }

  async listRelationTypes(): Promise<RelationType[]> {
    return this.relationsRepo.find({
      order: { id: 'ASC' },
      relations: { fromType: true, toType: true },
    });
  }

  async createRelationType(dto: CreateRelationTypeDto): Promise<RelationType> {
    await this.requireType(dto.fromTypeId);
    await this.requireType(dto.toTypeId);
    return this.save(this.relationsRepo, this.relationsRepo.create(dto));
  }

  async updateRelationType(
    id: number,
    dto: UpdateRelationTypeDto,
  ): Promise<RelationType> {
    await this.requireRelation(id);
    if (dto.fromTypeId) await this.requireType(dto.fromTypeId);
    if (dto.toTypeId) await this.requireType(dto.toTypeId);
    await this.save(this.relationsRepo, { id, ...dto });
    return this.requireRelation(id);
  }

  async removeRelationType(id: number): Promise<{ id: number }> {
    await this.requireRelation(id);
    await this.relationsRepo.delete(id);
    return { id };
  }

  private async save<T extends ObjectLiteral>(
    repo: Repository<T>,
    entity: object,
  ): Promise<T> {
    try {
      return await repo.save(entity as T);
    } catch (e: unknown) {
      if (
        typeof e === 'object' &&
        e !== null &&
        (e as { code?: string }).code === '23505'
      ) {
        throw new ConflictException('duplicate value violates unique constraint');
      }
      throw e;
    }
  }

  private async requireLayer(id: number): Promise<Layer> {
    const layer = await this.layersRepo.findOneBy({ id });
    if (!layer) {
      throw new NotFoundException(`layer ${id} not found`);
    }
    return layer;
  }

  private async requireType(id: number): Promise<ObjectType> {
    const type = await this.typesRepo.findOneBy({ id });
    if (!type) {
      throw new NotFoundException(`object type ${id} not found`);
    }
    return type;
  }

  private async requireRelation(id: number): Promise<RelationType> {
    const relation = await this.relationsRepo.findOneBy({ id });
    if (!relation) {
      throw new NotFoundException(`relation type ${id} not found`);
    }
    return relation;
  }
}
