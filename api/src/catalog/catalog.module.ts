import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Layer } from '../objects/entities/layer.entity';
import { ObjectType } from '../objects/entities/object-type.entity';
import { RelationType } from '../objects/entities/relation-type.entity';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';

@Module({
  imports: [TypeOrmModule.forFeature([Layer, ObjectType, RelationType])],
  controllers: [CatalogController],
  providers: [CatalogService],
})
export class CatalogModule {}
