import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class TicketPatchService {
  constructor(private readonly dataSource: DataSource) {}

  async lockTicketForUpdate(ticketId: number): Promise<Ticket> {
    try {
      const ticket = await this.dataSource
        .createQueryBuilder(Ticket, 'ticket')
        .setLock('pessimistic_write', undefined, ['nowait'])
        .where('ticket.id = :ticketId', { ticketId })
        .getOne();

      if (!ticket) {
        return null;
      }
      return ticket;
    } catch {
      throw new ConflictException(
        'This resource is being updated by another request. Please retry.',
      );
    }
  }
}
