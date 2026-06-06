import { ConflictException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Comment } from './entities/comment.entity';

@Injectable()
export class CommentPatchService {
  constructor(private readonly dataSource: DataSource) {}

  async lockCommentForUpdate(commentId: number): Promise<Comment | null> {
    try {
      return await this.dataSource
        .createQueryBuilder(Comment, 'comment')
        .setLock('pessimistic_write', undefined, ['nowait'])
        .where('comment.id = :commentId', { commentId })
        .getOne();
    } catch {
      throw new ConflictException(
        'This resource is being updated by another request. Please retry.',
      );
    }
  }
}
