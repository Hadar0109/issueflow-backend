import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { MentionsService } from './mentions.service';
import { AuditModule } from '../audit/audit.module';
import { Project } from '../projects/entities/project.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Mention } from '../comments/entities/mention.entity';
import { CommentsModule } from '../comments/comments.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Project, Ticket, Comment, Mention]),
    AuditModule,
    forwardRef(() => CommentsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository, MentionsService],
  exports: [UsersService, UsersRepository, MentionsService],
})
export class UsersModule {}
