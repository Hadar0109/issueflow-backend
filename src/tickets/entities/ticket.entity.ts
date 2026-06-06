import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  TicketPriority,
  TicketStatus,
  TicketType,
} from '../../common/enums';
import { Project } from '../../projects/entities/project.entity';
import { User } from '../../users/entities/user.entity';

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 500 })
  title: string;

  @Column({ type: 'text', default: '' })
  description: string;

  @Column({ type: 'enum', enum: TicketStatus })
  status: TicketStatus;

  @Column({ type: 'enum', enum: TicketPriority })
  priority: TicketPriority;

  @Column({ type: 'enum', enum: TicketType })
  type: TicketType;

  @Column()
  projectId: number;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'projectId' })
  project: Project;

  @Column({ nullable: true })
  assigneeId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigneeId' })
  assignee: User | null;

  @Column({ type: 'timestamptz', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'boolean', default: false })
  isOverdue: boolean;

  @DeleteDateColumn({ type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @Column({ nullable: true })
  deletedWithProjectId: number | null;

  @ManyToOne(() => Project, { nullable: true })
  @JoinColumn({ name: 'deletedWithProjectId' })
  deletedWithProject: Project | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
