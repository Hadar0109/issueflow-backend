import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mention } from '../comments/entities/mention.entity';
import { Comment } from '../comments/entities/comment.entity';
import { UsersRepository } from './users.repository';
import { MentionParserService } from '../comments/mention-parser.service';

@Injectable()
export class MentionsService {
  constructor(
    @InjectRepository(Mention)
    private readonly mentionRepository: Repository<Mention>,
    @InjectRepository(Comment)
    private readonly commentRepository: Repository<Comment>,
    private readonly usersRepository: UsersRepository,
    private readonly mentionParserService: MentionParserService,
  ) {}

  async findForUser(userId: number, page = 1, pageSize = 20) {
    const user = await this.usersRepository.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const skip = (page - 1) * pageSize;
    const [mentions, total] = await this.mentionRepository.findAndCount({
      where: { userId },
      relations: ['comment', 'comment.author'],
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    const data = await Promise.all(
      mentions.map(async (mention) => {
        const comment = mention.comment;
        const mentionedUsers = await this.mentionParserService.getMentionedUsers(comment.content);
        return {
          id: comment.id,
          ticketId: comment.ticketId,
          authorId: comment.authorId,
          content: comment.content,
          mentionedUsers,
        };
      }),
    );

    return { data, total, page };
  }
}
