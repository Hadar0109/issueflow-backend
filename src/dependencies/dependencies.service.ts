import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TicketDependency } from './entities/ticket-dependency.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditActor, AuditEntityType } from '../common/enums';

@Injectable()
export class DependenciesService {
  constructor(
    @InjectRepository(TicketDependency)
    private readonly dependencyRepository: Repository<TicketDependency>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly auditService: AuditService,
  ) {}

  async add(ticketId: number, dto: AddDependencyDto, actorId: number): Promise<void> {
    const ticket = await this.getActiveTicket(ticketId);
    const blocker = await this.getActiveTicket(dto.blockedBy);

    if (ticketId === dto.blockedBy) {
      throw new BadRequestException('A ticket cannot block itself');
    }
    if (ticket.projectId !== blocker.projectId) {
      throw new BadRequestException('Dependencies must be within the same project');
    }

    const existing = await this.dependencyRepository.findOne({
      where: { ticketId, blockedByTicketId: dto.blockedBy },
    });
    if (!existing) {
      await this.dependencyRepository.save({
        ticketId,
        blockedByTicketId: dto.blockedBy,
      });
      await this.auditService.log({
        action: AuditAction.ADD,
        entityType: AuditEntityType.DEPENDENCY,
        entityId: ticketId,
        performedBy: actorId,
        actor: AuditActor.USER,
        metadata: { blockedBy: dto.blockedBy },
      });
    }
  }

  async list(ticketId: number) {
    await this.getActiveTicket(ticketId);
    const deps = await this.dependencyRepository
      .createQueryBuilder('dep')
      .innerJoinAndSelect('dep.blockedByTicket', 'blocker')
      .where('dep.ticketId = :ticketId', { ticketId })
      .andWhere('blocker.deletedAt IS NULL')
      .getMany();

    return deps.map((d) => ({
      id: d.blockedByTicket.id,
      title: d.blockedByTicket.title,
      status: d.blockedByTicket.status,
    }));
  }

  async remove(ticketId: number, blockerId: number, actorId: number): Promise<void> {
    await this.getActiveTicket(ticketId);
    const dep = await this.dependencyRepository.findOne({
      where: { ticketId, blockedByTicketId: blockerId },
    });
    if (!dep) {
      throw new NotFoundException('Dependency not found');
    }
    await this.dependencyRepository.delete(dep.id);
    await this.auditService.log({
      action: AuditAction.REMOVE,
      entityType: AuditEntityType.DEPENDENCY,
      entityId: ticketId,
      performedBy: actorId,
      actor: AuditActor.USER,
      metadata: { blockedBy: blockerId },
    });
  }

  private async getActiveTicket(id: number): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }
}
