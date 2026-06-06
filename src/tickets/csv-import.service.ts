import { Injectable } from '@nestjs/common';
import { parse } from 'csv-parse/sync';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectMembershipService } from '../projects/project-membership.service';
import { AutoAssignService } from './auto-assign.service';
import { AuditService } from '../audit/audit.service';
import {
  AuditAction,
  AuditActor,
  AuditEntityType,
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../common/enums';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class CsvImportService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly projectsService: ProjectsService,
    private readonly projectMembershipService: ProjectMembershipService,
    private readonly autoAssignService: AutoAssignService,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
  ) {}

  async importCsv(
    buffer: Buffer,
    projectId: number,
    actorId: number,
  ): Promise<{ created: number; failed: number; errors: string[] }> {
    await this.projectsService.assertActiveProject(projectId);

    const records: Record<string, string>[] = parse(buffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return { created: 0, failed: 0, errors: [] };
    }

    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;
      try {
        if (!row.title?.trim()) {
          throw new Error('title is required');
        }

        const status = this.parseEnum(
          row.status,
          Object.values(TicketStatus),
          TicketStatus.TODO,
        );
        const priority = this.parseEnum(
          row.priority,
          Object.values(TicketPriority),
          TicketPriority.MEDIUM,
        );
        const type = this.parseEnum(
          row.type,
          Object.values(TicketType),
          TicketType.BUG,
        );

        let assigneeId: number | null = row.assigneeId
          ? parseInt(row.assigneeId, 10)
          : null;
        let autoAssigned = false;

        if (assigneeId) {
          const assignee = await this.usersRepository.findById(assigneeId);
          if (!assignee) {
            throw new Error('invalid assigneeId');
          }
          await this.projectMembershipService.linkIfDeveloper(projectId, assigneeId);
        } else {
          assigneeId = await this.autoAssignService.resolve(projectId);
          autoAssigned = assigneeId !== null;
        }

        const ticket = await this.ticketRepository.save({
          title: row.title,
          description: row.description ?? '',
          status,
          priority,
          type,
          projectId,
          assigneeId,
          dueDate: row.dueDate ? new Date(row.dueDate) : null,
          isOverdue: false,
        });

        await this.auditService.log({
          action: AuditAction.CREATE,
          entityType: AuditEntityType.TICKET,
          entityId: ticket.id,
          performedBy: actorId,
          actor: AuditActor.USER,
          metadata: { import: true, row: rowNum },
        });

        if (autoAssigned) {
          await this.auditService.log({
            action: AuditAction.AUTO_ASSIGN,
            entityType: AuditEntityType.TICKET,
            entityId: ticket.id,
            performedBy: null,
            actor: AuditActor.SYSTEM,
          });
        }

        created++;
      } catch (e) {
        failed++;
        errors.push(`Row ${rowNum}: ${(e as Error).message}`);
      }
    }

    return { created, failed, errors };
  }

  private parseEnum<T extends string>(
    value: string | undefined,
    allowed: T[],
    defaultValue: T,
  ): T {
    if (!value) return defaultValue;
    const upper = value.toUpperCase() as T;
    if (!allowed.includes(upper)) {
      throw new Error(`invalid enum value: ${value}`);
    }
    return upper;
  }
}
