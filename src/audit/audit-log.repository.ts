import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuditAction, AuditActor, AuditEntityType } from '../common/enums';

export interface AuditLogFilters {
  entityType?: AuditEntityType;
  entityId?: number;
  action?: AuditAction;
  actor?: AuditActor;
}

@Injectable()
export class AuditLogRepository {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
  ) {}

  async findFiltered(filters: AuditLogFilters): Promise<AuditLog[]> {
    const qb = this.auditLogRepository
      .createQueryBuilder('log')
      .orderBy('log.timestamp', 'DESC');

    if (filters.entityType) {
      qb.andWhere('log.entityType = :entityType', { entityType: filters.entityType });
    }
    if (filters.entityId !== undefined) {
      qb.andWhere('log.entityId = :entityId', { entityId: filters.entityId });
    }
    if (filters.action) {
      qb.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.actor) {
      qb.andWhere('log.actor = :actor', { actor: filters.actor });
    }

    return qb.getMany();
  }
}
