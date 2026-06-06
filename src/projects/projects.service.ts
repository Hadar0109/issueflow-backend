import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { UsersRepository } from '../users/users.repository';
import { ProjectMembershipService } from './project-membership.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditActor, AuditEntityType } from '../common/enums';
import { TransactionRunner } from '../common/database/transaction-runner';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly usersRepository: UsersRepository,
    private readonly projectMembershipService: ProjectMembershipService,
    private readonly auditService: AuditService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  async findAll() {
    const projects = await this.projectRepository.find({
      where: { deletedAt: IsNull() },
      order: { id: 'ASC' },
    });
    return projects.map((p) => this.toResponse(p));
  }

  async findOne(id: number) {
    const project = await this.projectRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.toResponse(project);
  }

  async findDeleted() {
    const projects = await this.projectRepository.find({
      where: { deletedAt: Not(IsNull()) },
      order: { id: 'ASC' },
      withDeleted: true,
    });
    return projects.map((p) => this.toResponse(p));
  }

  async create(dto: CreateProjectDto, actorId: number) {
    const owner = await this.usersRepository.findById(dto.ownerId);
    if (!owner) {
      throw new BadRequestException('Owner not found');
    }

    const project = await this.projectRepository.save({
      name: dto.name,
      description: dto.description ?? '',
      ownerId: dto.ownerId,
    });

    await this.projectMembershipService.linkIfDeveloper(project.id, dto.ownerId);

    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.PROJECT,
      entityId: project.id,
      performedBy: actorId,
      actor: AuditActor.USER,
    });

    return this.toResponse(project);
  }

  async update(id: number, dto: UpdateProjectDto, actorId: number) {
    const project = await this.projectRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (dto.name !== undefined) project.name = dto.name;
    if (dto.description !== undefined) project.description = dto.description;

    const updated = await this.projectRepository.save(project);
    await this.auditService.log({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.PROJECT,
      entityId: updated.id,
      performedBy: actorId,
      actor: AuditActor.USER,
    });
    return this.toResponse(updated);
  }

  async softDelete(id: number, actorId: number): Promise<void> {
    const project = await this.projectRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.transactionRunner.run(async (manager) => {
      const now = new Date();
      await manager.softDelete(Project, { id });

      const tickets = await manager.find(Ticket, {
        where: { projectId: id, deletedAt: IsNull() },
      });

      for (const ticket of tickets) {
        await manager.update(Ticket, ticket.id, {
          deletedAt: now,
          deletedWithProjectId: id,
        });
        await this.auditService.log({
          action: AuditAction.SOFT_DELETE,
          entityType: AuditEntityType.TICKET,
          entityId: ticket.id,
          performedBy: actorId,
          actor: AuditActor.USER,
          metadata: { cascade: true, projectId: id },
        });
      }

      await this.auditService.log({
        action: AuditAction.SOFT_DELETE,
        entityType: AuditEntityType.PROJECT,
        entityId: id,
        performedBy: actorId,
        actor: AuditActor.USER,
      });
    });
  }

  async restore(id: number, actorId: number) {
    const project = await this.projectRepository.findOne({
      where: { id },
      withDeleted: true,
    });
    if (!project || !project.deletedAt) {
      throw new NotFoundException('Project not found');
    }

    await this.transactionRunner.run(async (manager) => {
      await manager.restore(Project, { id });

      const tickets = await manager.find(Ticket, {
        where: { deletedWithProjectId: id },
        withDeleted: true,
      });

      for (const ticket of tickets) {
        await manager.update(Ticket, ticket.id, {
          deletedAt: null,
          deletedWithProjectId: null,
        });
        await this.auditService.log({
          action: AuditAction.RESTORE,
          entityType: AuditEntityType.TICKET,
          entityId: ticket.id,
          performedBy: actorId,
          actor: AuditActor.USER,
          metadata: { cascade: true, projectId: id },
        });
      }

      await this.auditService.log({
        action: AuditAction.RESTORE,
        entityType: AuditEntityType.PROJECT,
        entityId: id,
        performedBy: actorId,
        actor: AuditActor.USER,
      });
    });

    return this.findOne(id);
  }

  async assertActiveProject(projectId: number): Promise<Project> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, deletedAt: IsNull() },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  toResponse(project: Project) {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      ownerId: project.ownerId,
    };
  }
}
