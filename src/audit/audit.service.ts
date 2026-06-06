import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditAction, AuditActor, AuditEntityType } from '../common/enums';

export interface AuditLogInput {
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: number;
  performedBy?: number | null;
  actor: AuditActor;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async log(input: AuditLogInput): Promise<AuditLog> {
    const entry = this.auditLogRepository.create({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      performedBy: input.performedBy ?? null,
      actor: input.actor,
      metadata: input.metadata ?? null,
    });
    return this.auditLogRepository.save(entry);
  }
}
