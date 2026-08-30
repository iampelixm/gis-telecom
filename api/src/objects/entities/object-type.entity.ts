import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Layer } from './layer.entity';

@Entity('object_types')
export class ObjectType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @Index({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'int', nullable: true })
  layerId: number | null;

  @ManyToOne(() => Layer, { nullable: true })
  @JoinColumn({ name: 'layerId' })
  layer: Layer | null;

  @Column({ type: 'text' })
  geometryType: 'point' | 'linestring' | 'polygon' | 'multipoint' | 'multilinestring' | 'multipolygon';

  @Column({ type: 'text', nullable: true })
  color: string | null;

  @Column({ type: 'text', nullable: true })
  icon: string | null;

  @Column({ type: 'int', nullable: true })
  lineWidth: number | null;

  @Column({ type: 'jsonb', default: {} })
  attrsSchema: Record<string, unknown>;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
