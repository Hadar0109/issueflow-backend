import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class TicketsRepository {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  findActiveByProject(projectId: number): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { projectId, deletedAt: IsNull() },
      order: { id: 'ASC' },
    });
  }

  findActiveById(id: number): Promise<Ticket | null> {
    return this.ticketRepository.findOne({
      where: { id, deletedAt: IsNull() },
    });
  }

  findDeletedByProject(projectId: number): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { projectId, deletedAt: Not(IsNull()) },
      withDeleted: true,
      order: { id: 'ASC' },
    });
  }

  save(ticket: Partial<Ticket>): Promise<Ticket> {
    return this.ticketRepository.save(ticket);
  }
}
