import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { TokenRevocationService } from './token-revocation.service';

@Injectable()
export class TokenCleanupJob {
  private readonly logger = new Logger(TokenCleanupJob.name);

  constructor(private readonly tokenRevocationService: TokenRevocationService) {}

  @Cron('0 */6 * * *')
  async handleCleanup(): Promise<void> {
    const removed = await this.tokenRevocationService.purgeExpired();
    if (removed > 0) {
      this.logger.log(`Purged ${removed} expired revoked tokens`);
    }
  }
}
