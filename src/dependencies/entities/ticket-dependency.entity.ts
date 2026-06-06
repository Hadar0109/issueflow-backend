import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ticket } from '../../tickets/entities/ticket.entity';

@Entity('ticket_dependencies')
export class TicketDependency {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ticketId: number;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket: Ticket;

  @Column()
  blockedByTicketId: number;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blockedByTicketId' })
  blockedByTicket: Ticket;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
