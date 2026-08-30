import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectEntity } from './entities/object.entity';
import { ObjectType } from './entities/object-type.entity';
import { ObjectPermissionGuard } from './object-permission.guard';
import { ObjectsController } from './objects.controller';
import { ObjectsService } from './objects.service';

@Module({
  imports: [TypeOrmModule.forFeature([ObjectEntity, ObjectType])],
  controllers: [ObjectsController],
  providers: [ObjectsService, ObjectPermissionGuard],
})
export class ObjectsModule {}
