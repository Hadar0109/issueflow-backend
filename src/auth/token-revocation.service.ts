import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RevokedToken } from './entities/revoked-token.entity';

@Injectable()
export class TokenRevocationService {
  constructor(
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepository: Repository<RevokedToken>,
  ) {}

  async revoke(jti: string, expiresAt: Date): Promise<void> {
    const existing = await this.revokedTokenRepository.findOne({ where: { jti } });
    if (existing) {
      return;
    }
    await this.revokedTokenRepository.save({ jti, expiresAt });
  }

  async isRevoked(jti: string): Promise<boolean> {
    const token = await this.revokedTokenRepository.findOne({ where: { jti } });
    return !!token;
  }

  async purgeExpired(): Promise<number> {
    const result = await this.revokedTokenRepository.delete({
      expiresAt: LessThan(new Date()),
    });
    return result.affected ?? 0;
  }
}
