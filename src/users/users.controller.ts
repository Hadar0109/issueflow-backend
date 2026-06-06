import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { MentionsService } from './mentions.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from './entities/user.entity';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly mentionsService: MentionsService,
  ) {}

  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @Get(':userId/mentions')
  getMentions(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.mentionsService.findForUser(
      userId,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }

  @Get(':userId')
  findOne(@Param('userId', ParseIntPipe) userId: number) {
    return this.usersService.findOne(userId);
  }

  @HttpCode(200)
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() user: User) {
    return this.usersService.create(dto, user.id);
  }

  @HttpCode(200)
  @Post('update/:userId')
  update(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: User,
  ) {
    return this.usersService.update(userId, dto, user.id);
  }

  @HttpCode(200)
  @Delete(':userId')
  async remove(
    @Param('userId', ParseIntPipe) userId: number,
    @CurrentUser() user: User,
  ) {
    await this.usersService.delete(userId, user.id);
    return {};
  }
}
