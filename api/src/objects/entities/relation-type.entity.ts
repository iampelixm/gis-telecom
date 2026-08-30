import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ObjectType } from './object-type.entity';

@Entity('relation_types')
export class RelationType {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  @Index({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ type: 'int' })
  @Index()
  fromTypeId: number;

  @ManyToOne(() => ObjectType)
  @JoinColumn({ name: 'fromTypeId' })
  fromType: ObjectType;

  @Column({ type: 'int' })
  @Index()
  toTypeId: number;

  @ManyToOne(() => ObjectType)
  @JoinColumn({ name: 'toTypeId' })
  toType: ObjectType;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
