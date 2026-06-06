import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { PatchCommentDto } from './dto/patch-comment.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('tickets/:ticketId/comments')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get()
  findAll(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.commentsService.findByTicket(ticketId);
  }

  @HttpCode(200)
  @Post()
  create(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.create(ticketId, dto, user.id);
  }

  @HttpCode(200)
  @Patch(':commentId')
  patch(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: PatchCommentDto,
    @CurrentUser() user: User,
  ) {
    return this.commentsService.patch(ticketId, commentId, dto, user.id);
  }

  @HttpCode(200)
  @Delete(':commentId')
  async remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('commentId', ParseIntPipe) commentId: number,
    @CurrentUser() user: User,
  ) {
    await this.commentsService.delete(ticketId, commentId, user.id);
    return {};
  }
}
