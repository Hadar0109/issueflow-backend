import { TicketStatus } from '../common/enums';
import { Ticket } from './entities/ticket.entity';

export function computeIsOverdue(ticket: Ticket, now: Date): boolean {
  if (ticket.status === TicketStatus.DONE) {
    return false;
  }
  if (!ticket.dueDate) {
    return false;
  }
  if (ticket.isOverdue) {
    return true;
  }
  // BR-05: when isOverdue was cleared (e.g. manual priority PATCH), keep false until escalation sets the flag again
  return false;
}
