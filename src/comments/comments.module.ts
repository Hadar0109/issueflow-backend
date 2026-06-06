import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { Mention } from './entities/mention.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { User } from '../users/entities/user.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { MentionParserService } from './mention-parser.service';
import { CommentPatchService } from './comment-patch.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, Mention, Ticket, User]),
    AuditModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService, MentionParserService, CommentPatchService],
  exports: [MentionParserService],
})
export class CommentsModule {}
