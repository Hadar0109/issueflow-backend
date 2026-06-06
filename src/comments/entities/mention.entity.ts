import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Comment } from './comment.entity';
import { User } from '../../users/entities/user.entity';

@Entity('mentions')
export class Mention {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  commentId: number;

  @ManyToOne(() => Comment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'commentId' })
  comment: Comment;

  @Column()
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
