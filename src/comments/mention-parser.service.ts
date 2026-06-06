import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mention } from './entities/mention.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class MentionParserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Mention)
    private readonly mentionRepository: Repository<Mention>,
  ) {}

  async getMentionedUsers(content: string) {
    const usernames = this.extractUsernames(content);
    const users: User[] = [];
    for (const username of usernames) {
      const user = await this.userRepository
        .createQueryBuilder('user')
        .where('LOWER(user.username) = LOWER(:username)', { username })
        .getOne();
      if (user) {
        users.push(user);
      }
    }
    return users.map((u) => ({
      id: u.id,
      username: u.username,
      fullName: u.fullName,
    }));
  }

  async rebuildMentions(commentId: number, content: string): Promise<void> {
    await this.mentionRepository.delete({ commentId });
    const usernames = this.extractUsernames(content);
    const seen = new Set<string>();
    for (const username of usernames) {
      const key = username.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const user = await this.userRepository
        .createQueryBuilder('user')
        .where('LOWER(user.username) = LOWER(:username)', { username })
        .getOne();
      if (user) {
        await this.mentionRepository.save({ commentId, userId: user.id });
      }
    }
  }

  private extractUsernames(content: string): string[] {
    const matches = content.match(/@(\w+)/g) ?? [];
    return matches.map((m) => m.slice(1));
  }
}
