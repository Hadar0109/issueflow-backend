import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @HttpCode(200)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @HttpCode(200)
  @Post('logout')
  async logout(@CurrentUser() user: User, @Req() req: Request) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      const decoded = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64').toString(),
      ) as { jti: string; exp: number };
      await this.authService.logout(user, decoded.jti, decoded.exp);
    }
    return {};
  }

  @Get('me')
  me(@CurrentUser() user: User) {
    return this.authService.me(user);
  }
}
