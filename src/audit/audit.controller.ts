import { Controller, Get, Query } from '@nestjs/common';
import { AuditLogRepository } from './audit-log.repository';
import { AuditAction, AuditActor, AuditEntityType } from '../common/enums';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditLogRepository: AuditLogRepository) {}

  @Get()
  async findAll(
    @Query('entityType') entityType?: AuditEntityType,
    @Query('entityId') entityId?: string,
    @Query('action') action?: AuditAction,
    @Query('actor') actor?: AuditActor,
  ) {
    const logs = await this.auditLogRepository.findFiltered({
      entityType,
      entityId: entityId ? parseInt(entityId, 10) : undefined,
      action,
      actor,
    });
    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      performedBy: log.performedBy,
      actor: log.actor,
      timestamp: log.timestamp.toISOString(),
    }));
  }
}
