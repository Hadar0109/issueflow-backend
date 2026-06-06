import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketStatus } from '../common/enums';
import { Ticket } from './entities/ticket.entity';
import { TicketDependency } from '../dependencies/entities/ticket-dependency.entity';

const STATUS_ORDER: TicketStatus[] = [
  TicketStatus.TODO,
  TicketStatus.IN_PROGRESS,
  TicketStatus.IN_REVIEW,
  TicketStatus.DONE,
];

@Injectable()
export class TicketStatusService {
  constructor(
    @InjectRepository(TicketDependency)
    private readonly dependencyRepository: Repository<TicketDependency>,
  ) {}

  assertNotDone(ticket: Ticket): void {
    if (ticket.status === TicketStatus.DONE) {
      throw new BadRequestException('DONE tickets cannot be modified');
    }
  }

  validateTransition(current: TicketStatus, next: TicketStatus): void {
    if (current === next) {
      return;
    }
    const currentIdx = STATUS_ORDER.indexOf(current);
    const nextIdx = STATUS_ORDER.indexOf(next);
    if (nextIdx <= currentIdx) {
      throw new BadRequestException('Status can only move forward');
    }
  }

  async assertCanTransitionToDone(ticketId: number): Promise<void> {
    const blockers = await this.dependencyRepository
      .createQueryBuilder('dep')
      .innerJoin('dep.blockedByTicket', 'blocker')
      .where('dep.ticketId = :ticketId', { ticketId })
      .andWhere('blocker.deletedAt IS NULL')
      .andWhere('blocker.status != :done', { done: TicketStatus.DONE })
      .getMany();

    if (blockers.length > 0) {
      throw new BadRequestException(
        'Cannot mark DONE while unresolved direct blockers exist',
      );
    }
  }
}
