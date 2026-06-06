import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TicketEscalationService } from '../tickets/ticket-escalation.service';

@Injectable()
export class EscalationJob {
  private readonly logger = new Logger(EscalationJob.name);

  constructor(private readonly ticketEscalationService: TicketEscalationService) {}

  @Cron('*/1 * * * *')
  async handleEscalation(): Promise<void> {
    const count = await this.ticketEscalationService.processOverdueTickets();
    if (count > 0) {
      this.logger.log(`Escalated ${count} overdue tickets`);
    }
  }
}
