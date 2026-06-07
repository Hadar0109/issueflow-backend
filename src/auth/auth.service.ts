import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { TokenRevocationService } from './token-revocation.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, AuditActor, AuditEntityType } from '../common/enums';

export interface JwtPayload {
  sub: number;
  jti: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tokenRevocationService: TokenRevocationService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto) {
    if (!dto.username?.trim() || !dto.password?.trim()) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.userRepository
      .createQueryBuilder('user')
      .where('LOWER(user.username) = LOWER(:username)', { username: dto.username })
      .getOne();

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.passwordHash === null) {
      user.passwordHash = await bcrypt.hash(dto.password, 10);
      await this.userRepository.save(user);
    } else {
      const valid = await bcrypt.compare(dto.password, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('Invalid credentials');
      }
    }

    const expiresIn = this.configService.get<number>('jwtExpiresIn', 3600);
    const jti = randomUUID();
    const payload: JwtPayload = { sub: user.id, jti };
    const accessToken = this.jwtService.sign(payload, { expiresIn });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  async logout(user: User, jti: string, exp: number): Promise<void> {
    const expiresAt = new Date(exp * 1000);
    await this.tokenRevocationService.revoke(jti, expiresAt);
    await this.auditService.log({
      action: AuditAction.LOGOUT,
      entityType: AuditEntityType.AUTH,
      entityId: user.id,
      performedBy: user.id,
      actor: AuditActor.USER,
    });
  }

  async me(user: User) {
    return this.toUserResponse(user);
  }

  toUserResponse(user: User) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
  }
}
