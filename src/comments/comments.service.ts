import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Comment } from './entities/comment.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PatchCommentDto } from './dto/patch-comment.dto';
import { MentionParserService } from './mention-parser.service';
import { CommentPatchService } from './comment-patch.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditActor, AuditEntityType } from '../common/enums';
import { TransactionRunner } from '../common/database/transaction-runner';

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly mentionParserService: MentionParserService,
    private readonly commentPatchService: CommentPatchService,
    private readonly auditService: AuditService,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  private async assertActiveTicket(ticketId: number): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, deletedAt: IsNull() },
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  async findByTicket(ticketId: number) {
    await this.assertActiveTicket(ticketId);
    const comments = await this.commentRepository.find({
      where: { ticketId },
      order: { id: 'ASC' },
    });
    return Promise.all(comments.map((c) => this.toResponse(c)));
  }

  async create(ticketId: number, dto: CreateCommentDto, jwtUserId: number) {
    if (dto.authorId !== jwtUserId) {
      throw new BadRequestException('authorId must match authenticated user');
    }
    await this.assertActiveTicket(ticketId);

    const comment = await this.commentRepository.save({
      ticketId,
      authorId: dto.authorId,
      content: dto.content,
    });

    await this.mentionParserService.rebuildMentions(comment.id, dto.content);
    await this.auditService.log({
      action: AuditAction.CREATE,
      entityType: AuditEntityType.COMMENT,
      entityId: comment.id,
      performedBy: jwtUserId,
      actor: AuditActor.USER,
    });
    return this.toResponse(comment);
  }

  async patch(
    ticketId: number,
    commentId: number,
    dto: PatchCommentDto,
    jwtUserId: number,
  ) {
    await this.assertActiveTicket(ticketId);

    return this.transactionRunner.withQueryRunner(async (queryRunner) => {
      let comment: Comment;
      try {
        comment = await queryRunner.manager
          .createQueryBuilder(Comment, 'comment')
          .setLock('pessimistic_write', undefined, ['nowait'])
          .where('comment.id = :commentId', { commentId })
          .getOne();
      } catch {
        throw new ConflictException(
          'This resource is being updated by another request. Please retry.',
        );
      }
      if (!comment || comment.ticketId !== ticketId) {
        throw new NotFoundException('Comment not found');
      }
      if (comment.authorId !== jwtUserId) {
        throw new BadRequestException('authorId must match authenticated user');
      }

      comment.content = dto.content;
      const saved = await queryRunner.manager.save(Comment, comment);
      await this.mentionParserService.rebuildMentions(saved.id, dto.content);
      await this.auditService.log({
        action: AuditAction.UPDATE,
        entityType: AuditEntityType.COMMENT,
        entityId: saved.id,
        performedBy: jwtUserId,
        actor: AuditActor.USER,
      });
      return this.toResponse(saved);
    });
  }

  async delete(ticketId: number, commentId: number, jwtUserId: number) {
    await this.assertActiveTicket(ticketId);
    const comment = await this.commentRepository.findOne({
      where: { id: commentId, ticketId },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    if (comment.authorId !== jwtUserId) {
      throw new BadRequestException('authorId must match authenticated user');
    }
    await this.commentRepository.delete(commentId);
    await this.auditService.log({
      action: AuditAction.DELETE,
      entityType: AuditEntityType.COMMENT,
      entityId: commentId,
      performedBy: jwtUserId,
      actor: AuditActor.USER,
    });
  }

  async toResponse(comment: Comment) {
    const mentionedUsers = await this.mentionParserService.getMentionedUsers(
      comment.content,
    );
    return {
      id: comment.id,
      ticketId: comment.ticketId,
      authorId: comment.authorId,
      content: comment.content,
      mentionedUsers,
    };
  }
}
