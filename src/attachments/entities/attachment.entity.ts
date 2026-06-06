import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Ticket } from '../../tickets/entities/ticket.entity';

@Entity('attachments')
export class Attachment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  ticketId: number;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticketId' })
  ticket: Ticket;

  @Column({ type: 'varchar', length: 255 })
  filename: string;

  @Column({ type: 'varchar', length: 100 })
  contentType: string;

  @Column({ type: 'varchar', length: 500 })
  storagePath: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
