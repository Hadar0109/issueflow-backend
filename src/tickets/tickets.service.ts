import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { PatchTicketDto } from './dto/patch-ticket.dto';
import { TicketsRepository } from './tickets.repository';
import { ProjectsService } from '../projects/projects.service';
import { ProjectMembershipService } from '../projects/project-membership.service';
import { TicketStatusService } from './ticket-status.service';
import { lockRowForUpdateNowait } from '../common/database/pessimistic-lock';
import { AutoAssignService } from './auto-assign.service';
import { UsersRepository } from '../users/users.repository';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditActor, AuditEntityType, TicketStatus } from '../common/enums';
import { computeIsOverdue } from './overdue-calculator';
import { CLOCK, Clock } from '../common/utils/clock';
import { Inject } from '@nestjs/common';
import { TransactionRunner } from '../common/database/transaction-runner';

@Injectable()
export class TicketsService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly projectsService: ProjectsService,
    private readonly projectMembershipService: ProjectMembershipService,
    private readonly ticketStatusService: TicketStatusService,
    private readonly autoAssignService: AutoAssignService,
    private readonly usersRepository: UsersRepository,
    private readonly auditService: AuditService,
    private readonly transactionRunner: TransactionRunner,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async findByProject(projectId: number) {
    await this.projectsService.assertActiveProject(projectId);
    const tickets = await this.ticketsRepository.findActiveByProject(projectId);
    return tickets.map((t) => this.toResponse(t));
  }

  async findOne(id: number) {
    const ticket = await this.ticketsRepository.findActiveById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return this.toResponse(ticket);
  }

  async findDeleted(projectId: number) {
    const tickets = await this.ticketsRepository.findDeletedByProject(projectId);
    return tickets.map((t) => ({
      id: t.id,
      title: t.title,
      status: t.status,
      priority: t.priority,
      type: t.type,
      projectId: t.projectId,
    }));
  }

  async create(dto: CreateTicketDto, actorId: number) {
    await this.projectsService.assertActiveProject(dto.projectId);

    let assigneeId = dto.assigneeId ?? null;
    let autoAssigned = false;

    if (assigneeId !== null && assigneeId !== undefined) {
      const assignee = await this.usersRepository.findById(assigneeId);
      if (!assignee) {
        throw new BadRequestException('Assignee not found');
      }
      await this.projectMembershipService.linkIfDeveloper(dto.projectId, assigneeId);
    } else {
      assigneeId = await this.autoAssignService.resolve(dto.projectId);
      autoAssigned = assigneeId !== null;
    }

    const ticket = await this.ticketsRepository.save({
      title: dto.title,
      description: dto.description ?? '',
      status: dto.status,
      priority: dto.priority,
      type: dto.type,
      projectId: dto.projectId,
      assigneeId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      isOverdue: false,
    });

    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.TICKET,
      entityId: ticket.id,
      performedBy: actorId,
      actor: AuditActor.USER,
    });

    if (autoAssigned) {
      await this.auditService.log({
        action: AuditAction.AUTO_ASSIGN,
        entityType: AuditEntityType.TICKET,
        entityId: ticket.id,
        performedBy: null,
        actor: AuditActor.SYSTEM,
        metadata: { assigneeId },
      });
    }

    return this.toResponse(ticket);
  }

  async patch(id: number, dto: PatchTicketDto, actorId: number) {
    return this.transactionRunner.withQueryRunner(async (queryRunner) => {
      const ticket = await lockRowForUpdateNowait(
        queryRunner.manager,
        Ticket,
        'ticket',
        'id',
        id,
      );
      if (!ticket || ticket.deletedAt) {
        throw new NotFoundException('Ticket not found');
      }

      await this.projectsService.assertActiveProject(ticket.projectId);
      this.ticketStatusService.assertNotDone(ticket);

      if (dto.status) {
        this.ticketStatusService.validateTransition(ticket.status, dto.status);
        if (dto.status === TicketStatus.DONE) {
          await this.ticketStatusService.assertCanTransitionToDone(id);
        }
        ticket.status = dto.status;
      }

      if (dto.title !== undefined) ticket.title = dto.title;
      if (dto.description !== undefined) ticket.description = dto.description;
      if (dto.dueDate !== undefined) {
        ticket.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
      }

      if (dto.priority !== undefined) {
        ticket.priority = dto.priority;
        ticket.isOverdue = false;
      }

      if (dto.assigneeId !== undefined) {
        if (dto.assigneeId !== null) {
          const assignee = await this.usersRepository.findById(dto.assigneeId);
          if (!assignee) {
            throw new BadRequestException('Assignee not found');
          }
          await this.projectMembershipService.linkIfDeveloper(
            ticket.projectId,
            dto.assigneeId,
          );
        }
        ticket.assigneeId = dto.assigneeId;
      }

      const saved = await queryRunner.manager.save(Ticket, ticket);
      await this.auditService.log({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.TICKET,
        entityId: saved.id,
        performedBy: actorId,
        actor: AuditActor.USER,
      });
      return this.toResponse(saved);
    });
  }

  async softDelete(id: number, actorId: number): Promise<void> {
    const ticket = await this.ticketsRepository.findActiveById(id);
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    await this.ticketRepository.softDelete(id);
    await this.auditService.log({
      action: AuditAction.SOFT_DELETE,
      entityType: AuditEntityType.TICKET,
      entityId: id,
      performedBy: actorId,
      actor: AuditActor.USER,
    });
  }

  async restore(id: number, actorId: number) {
    const ticket = await this.ticketRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!ticket || !ticket.deletedAt) {
      throw new NotFoundException('Ticket not found');
    }
    if (ticket.deletedWithProjectId) {
      const project = await this.projectsService.findOne(ticket.deletedWithProjectId).catch(() => null);
      if (!project) {
        throw new NotFoundException('Parent project is still deleted');
      }
    }
    await this.ticketRepository.restore({ id });
    await this.ticketRepository.update(id, { deletedWithProjectId: null });
    await this.auditService.log({
      action: AuditAction.RESTORE,
      entityType: AuditEntityType.TICKET,
      entityId: id,
      performedBy: actorId,
      actor: AuditActor.USER,
    });
    return this.findOne(id);
  }

  toResponse(ticket: Ticket) {
    const now = this.clock.now();
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      type: ticket.type,
      projectId: ticket.projectId,
      assigneeId: ticket.assigneeId,
      dueDate: ticket.dueDate?.toISOString() ?? null,
      isOverdue: computeIsOverdue(ticket, now),
    };
  }
}
