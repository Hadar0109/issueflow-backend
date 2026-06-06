import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';
import {
  TicketPriority,
  TicketStatus,
  AuditAction,
  AuditActor,
  AuditEntityType,
} from '../common/enums';
import { CLOCK, Clock } from '../common/utils/clock';
import { AuditService } from '../audit/audit.service';

const PRIORITY_LADDER: TicketPriority[] = [
  TicketPriority.LOW,
  TicketPriority.MEDIUM,
  TicketPriority.HIGH,
  TicketPriority.CRITICAL,
];

@Injectable()
export class TicketEscalationService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly auditService: AuditService,
  ) {}

  async processOverdueTickets(): Promise<number> {
    const now = this.clock.now();
    const tickets = await this.ticketRepository.find({
      where: {
        deletedAt: IsNull(),
        status: Not(TicketStatus.DONE),
        dueDate: Not(IsNull()),
      },
    });

    let escalated = 0;
    for (const ticket of tickets) {
      if (!ticket.dueDate || ticket.dueDate >= now) {
        continue;
      }
      if (ticket.status === TicketStatus.DONE) {
        continue;
      }

      const currentIdx = PRIORITY_LADDER.indexOf(ticket.priority);
      if (currentIdx < PRIORITY_LADDER.length - 1) {
        ticket.priority = PRIORITY_LADDER[currentIdx + 1];
        ticket.isOverdue = false;
      } else {
        ticket.isOverdue = true;
      }

      await this.ticketRepository.save(ticket);
      await this.auditService.log({
        action: AuditAction.ESCALATE,
        entityType: AuditEntityType.TICKET,
        entityId: ticket.id,
        performedBy: null,
        actor: AuditActor.SYSTEM,
      });
      escalated++;
    }
    return escalated;
  }
}
