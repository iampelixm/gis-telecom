import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type ChangeLogEntityType = 'object' | 'relation';
export type ChangeLogAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'moved';

@Entity('change_log')
export class ChangeLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar' })
  @Index('IDX_change_log_entity')
  entityType: ChangeLogEntityType;

  @Column({ type: 'int' })
  @Index('IDX_change_log_entity')
  entityId: number;

  @Column({ type: 'varchar' })
  typeCode: string;

  @Column({ type: 'varchar' })
  action: ChangeLogAction;

  @Column({ type: 'varchar', nullable: true })
  actor: string | null;

  @Column({ type: 'jsonb', nullable: true })
  changes: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
