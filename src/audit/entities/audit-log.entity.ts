import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditAction, AuditActor, AuditEntityType } from '../../common/enums';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 32 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 32 })
  entityType: AuditEntityType;

  @Column({ type: 'int' })
  entityId: number;

  @Column({ type: 'int', nullable: true })
  performedBy: number | null;

  @Column({ type: 'enum', enum: AuditActor })
  actor: AuditActor;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;
}
