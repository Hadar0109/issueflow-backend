import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { JwtPayload } from './auth.service';
import { TokenRevocationService } from './token-revocation.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly tokenRevocationService: TokenRevocationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwtSecret'),
      passReqToCallback: true,
    });
  }

  async validate(req: { user?: { jti?: string } }, payload: JwtPayload): Promise<User> {
    if (await this.tokenRevocationService.isRevoked(payload.jti)) {
      throw new UnauthorizedException();
    }

    const user = await this.userRepository.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException();
    }

    (req as { user?: User & { jti?: string } }).user = { ...user, jti: payload.jti };
    return user;
  }
}
