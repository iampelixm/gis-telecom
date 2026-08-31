import { DataSource } from 'typeorm';
import { Layer } from '../objects/entities/layer.entity';
import { ObjectType } from '../objects/entities/object-type.entity';
import { ObjectEntity } from '../objects/entities/object.entity';
import { RelationType } from '../objects/entities/relation-type.entity';
import { ObjectRelation } from '../objects/entities/object-relation.entity';
import { ChangeLog } from '../audit/entities/change-log.entity';

export const dataSourceOptions = {
  type: 'postgres' as const,
  host: process.env.DB_HOST || 'db',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'gis',
  username: process.env.DB_USER || 'gis',
  password: process.env.DB_PASSWORD || 'gis',
  entities: [Layer, ObjectType, ObjectEntity, RelationType, ObjectRelation, ChangeLog],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  migrationsRun: true,
  synchronize: false,
  logging: false,
};

const dataSource = new DataSource(dataSourceOptions);

export default dataSource;
