import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../users/entities/user.entity';
import { RevokedToken } from './entities/revoked-token.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { TokenRevocationService } from './token-revocation.service';
import { TokenCleanupJob } from './token-cleanup.job';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RevokedToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwtSecret'),
        signOptions: { expiresIn: configService.get<number>('jwtExpiresIn', 3600) },
      }),
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    TokenRevocationService,
    TokenCleanupJob,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
