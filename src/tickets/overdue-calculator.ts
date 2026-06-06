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
  return now > new Date(ticket.dueDate);
}
