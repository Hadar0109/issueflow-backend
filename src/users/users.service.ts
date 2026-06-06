import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersRepository } from './users.repository';
import { TransactionRunner } from '../common/database/transaction-runner';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditActor, AuditEntityType } from '../common/enums';
import { Project } from '../projects/entities/project.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Mention } from '../comments/entities/mention.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { TicketStatus } from '../common/enums';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly transactionRunner: TransactionRunner,
    private readonly auditService: AuditService,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async findAll() {
    const users = await this.usersRepository.findAll();
    return users.map((u) => this.toResponse(u));
  }

  async findOne(id: number) {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toResponse(user);
  }

  async create(dto: CreateUserDto, actorId: number) {
    if (/\s/.test(dto.username)) {
      throw new BadRequestException('Username must not contain whitespace');
    }

    const existingUsername = await this.usersRepository.findByUsernameCi(dto.username);
    if (existingUsername) {
      throw new ConflictException('Username already exists');
    }

    const existingEmail = await this.usersRepository.findByEmailCi(dto.email);
    if (existingEmail) {
      throw new ConflictException('Email already exists');
    }

    const user = await this.usersRepository.save(dto);
    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      performedBy: actorId,
      actor: AuditActor.USER,
    });
    return this.toResponse(user);
  }

  async update(id: number, dto: UpdateUserDto, actorId: number) {
    if (!dto.fullName && !dto.role) {
      throw new BadRequestException('At least one of fullName or role must be provided');
    }

    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.role !== undefined) user.role = dto.role;

    const updated = await this.usersRepository.save(user);
    await this.auditService.log({
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.USER,
      entityId: updated.id,
      performedBy: actorId,
      actor: AuditActor.USER,
    });
    return this.toResponse(updated);
  }

  async delete(id: number, actorId: number): Promise<void> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const ownsProject = await this.projectRepository.count({ where: { ownerId: id } });
    if (ownsProject > 0) {
      throw new ConflictException('Cannot delete user who owns a project');
    }

    const nonDoneAssignee = await this.ticketRepository.count({
      where: {
        assigneeId: id,
        status: Not(TicketStatus.DONE),
      },
    });
    if (nonDoneAssignee > 0) {
      throw new ConflictException('Cannot delete user assigned to non-DONE tickets');
    }

    await this.transactionRunner.run(async (manager) => {
      const authoredComments = await manager.find(Comment, { where: { authorId: id } });
      const commentIds = authoredComments.map((c) => c.id);
      if (commentIds.length > 0) {
        await manager.delete(Mention, { commentId: In(commentIds) });
        await manager.delete(Comment, { authorId: id });
      }
      await manager.delete(Mention, { userId: id });
      await manager.delete(ProjectMember, { userId: id });
      await manager.update(Ticket, { assigneeId: id }, { assigneeId: null });
      await this.auditService.log({
        action: AuditAction.DELETE,
        entityType: AuditEntityType.USER,
        entityId: id,
        performedBy: actorId,
        actor: AuditActor.USER,
      });
      await manager.delete(User, { id });
    });
  }

  toResponse(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
