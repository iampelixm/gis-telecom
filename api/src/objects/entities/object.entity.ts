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
import { ObjectType } from './object-type.entity';

@Entity('objects')
export class ObjectEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  @Index()
  objectTypeId: number;

  @ManyToOne(() => ObjectType)
  @JoinColumn({ name: 'objectTypeId' })
  objectType: ObjectType;

  @Column({
    type: 'geometry',
    srid: 4326,
  })
  @Index({ spatial: true })
  geometry: object;

  @Column({ type: 'jsonb', default: {} })
  attrs: Record<string, unknown>;

  @Column({ type: 'text', nullable: true })
  createdBy: string | null;

  @Column({ type: 'text', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
