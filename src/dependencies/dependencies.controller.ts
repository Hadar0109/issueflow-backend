import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { DependenciesService } from './dependencies.service';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('tickets/:ticketId/dependencies')
export class DependenciesController {
  constructor(private readonly dependenciesService: DependenciesService) {}

  @HttpCode(200)
  @Post()
  async add(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() dto: AddDependencyDto,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.dependenciesService.add(ticketId, dto, user.id);
  }

  @Get()
  list(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.dependenciesService.list(ticketId);
  }

  @HttpCode(200)
  @Delete(':blockerId')
  async remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Param('blockerId', ParseIntPipe) blockerId: number,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.dependenciesService.remove(ticketId, blockerId, user.id);
  }
}
