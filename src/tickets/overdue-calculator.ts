import { TicketStatus } from '../common/enums';
import { Ticket } from './entities/ticket.entity';

/**
 * API `isOverdue` reflects the persisted flag set by escalation at CRITICAL (BR-04),
 * not immediate calendar overdue (BR-06). Manual priority PATCH clears the flag (BR-05).
 */
export function computeIsOverdue(ticket: Ticket, _now: Date): boolean {
  if (ticket.status === TicketStatus.DONE) {
    return false;
  }
  if (!ticket.dueDate) {
    return false;
  }
  return ticket.isOverdue;
}
