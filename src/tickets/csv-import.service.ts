import { BadRequestException, Injectable } from '@nestjs/common';
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

const EXPECTED_COLUMNS = [
  'title',
  'description',
  'status',
  'priority',
  'type',
  'assigneeId',
] as const;

const DOCUMENTED_DEFAULTS = {
  status: TicketStatus.TODO,
  priority: TicketPriority.MEDIUM,
  type: TicketType.FEATURE,
} as const;

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

    let records: Record<string, string>[];
    try {
      records = parse(buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      });
    } catch {
      throw new BadRequestException('Invalid CSV format');
    }

    if (records.length === 0) {
      return { created: 0, failed: 0, errors: [] };
    }

    this.assertExpectedColumns(records[0]);

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
          DOCUMENTED_DEFAULTS.status,
          'status',
        );
        const priority = this.parseEnum(
          row.priority,
          Object.values(TicketPriority),
          DOCUMENTED_DEFAULTS.priority,
          'priority',
        );
        const type = this.parseEnum(
          row.type,
          Object.values(TicketType),
          DOCUMENTED_DEFAULTS.type,
          'type',
        );

        let assigneeId: number | null = null;
        let autoAssigned = false;

        if (row.assigneeId?.trim()) {
          assigneeId = parseInt(row.assigneeId, 10);
          if (Number.isNaN(assigneeId)) {
            throw new Error('invalid assigneeId');
          }
          const assignee = await this.usersRepository.findById(assigneeId);
          if (!assignee) {
            throw new Error('invalid assigneeId');
          }
          await this.projectMembershipService.linkIfDeveloper(projectId, assigneeId);
        } else {
          assigneeId = await this.autoAssignService.resolve(projectId);
          autoAssigned = assigneeId !== null;
        }

        let dueDate: Date | null = null;
        if (row.dueDate?.trim()) {
          const parsed = new Date(row.dueDate);
          if (Number.isNaN(parsed.getTime())) {
            throw new Error('invalid dueDate');
          }
          dueDate = parsed;
        }

        const ticket = await this.ticketRepository.save({
          title: row.title.trim(),
          description: row.description ?? '',
          status,
          priority,
          type,
          projectId,
          assigneeId,
          dueDate,
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

  private assertExpectedColumns(firstRow: Record<string, string>): void {
    const headers = Object.keys(firstRow);
    const missing = EXPECTED_COLUMNS.filter((col) => !headers.includes(col));
    const unexpected = headers.filter(
      (col) => !EXPECTED_COLUMNS.includes(col as (typeof EXPECTED_COLUMNS)[number]) && col !== 'id',
    );
    if (missing.length > 0 || unexpected.length > 0) {
      throw new BadRequestException(
        `Invalid CSV columns. Expected: ${EXPECTED_COLUMNS.join(', ')}`,
      );
    }
  }

  private parseEnum<T extends string>(
    value: string | undefined,
    allowed: T[],
    documentedDefault: T,
    fieldName: string,
  ): T {
    if (!value?.trim()) {
      return documentedDefault;
    }
    const normalized = value.trim().toUpperCase() as T;
    if (!allowed.includes(normalized)) {
      throw new Error(`invalid ${fieldName}: ${value}`);
    }
    return normalized;
  }
}
