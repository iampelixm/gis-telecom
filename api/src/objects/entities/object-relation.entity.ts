import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { RelationType } from './relation-type.entity';
import { ObjectEntity } from './object.entity';

@Entity('object_relations')
export class ObjectRelation {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  relationTypeId: number;

  @ManyToOne(() => RelationType)
  @JoinColumn({ name: 'relation_type_id' })
  relationType: RelationType;

  @Column({ type: 'int' })
  @Index()
  fromObjectId: number;

  @ManyToOne(() => ObjectEntity)
  @JoinColumn({ name: 'from_object_id' })
  fromObject: ObjectEntity;

  @Column({ type: 'int' })
  @Index()
  toObjectId: number;

  @ManyToOne(() => ObjectEntity)
  @JoinColumn({ name: 'to_object_id' })
  toObject: ObjectEntity;

  @Column({ type: 'jsonb', default: {} })
  attrs: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
