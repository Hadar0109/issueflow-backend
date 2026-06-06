import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TicketsService } from './tickets.service';
import { CsvExportService } from './csv-export.service';
import { CsvImportService } from './csv-import.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { PatchTicketDto } from './dto/patch-ticket.dto';
import { ImportTicketsDto } from './dto/import-tickets.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { UserRole } from '../common/enums';
import { User } from '../users/entities/user.entity';

@Controller('tickets')
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly csvExportService: CsvExportService,
    private readonly csvImportService: CsvImportService,
  ) {}

  @Get('deleted')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  findDeleted(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.ticketsService.findDeleted(projectId);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv')
  async export(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.csvExportService.export(projectId);
  }

  @HttpCode(200)
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importTickets(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: ImportTicketsDto,
    @CurrentUser() user: User,
  ) {
    if (!file) {
      throw new BadRequestException('CSV file is required');
    }
    return this.csvImportService.importCsv(file.buffer, dto.projectId, user.id);
  }

  @Get()
  findByProject(@Query('projectId', ParseIntPipe) projectId: number) {
    return this.ticketsService.findByProject(projectId);
  }

  @Get(':ticketId')
  findOne(@Param('ticketId', ParseIntPipe) ticketId: number) {
    return this.ticketsService.findOne(ticketId);
  }

  @HttpCode(200)
  @Post()
  create(@Body() dto: CreateTicketDto, @CurrentUser() user: User) {
    return this.ticketsService.create(dto, user.id);
  }

  @HttpCode(200)
  @Patch(':ticketId')
  patch(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @Body() body: PatchTicketDto & { type?: string },
    @CurrentUser() user: User,
  ) {
    if ('type' in body && body.type !== undefined) {
      throw new BadRequestException('type cannot be updated');
    }
    const { type: _type, ...dto } = body;
    return this.ticketsService.patch(ticketId, dto, user.id);
  }

  @HttpCode(200)
  @Delete(':ticketId')
  async remove(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @CurrentUser() user: User,
  ) {
    await this.ticketsService.softDelete(ticketId, user.id);
    return {};
  }

  @HttpCode(200)
  @Post(':ticketId/restore')
  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN)
  restore(
    @Param('ticketId', ParseIntPipe) ticketId: number,
    @CurrentUser() user: User,
  ) {
    return this.ticketsService.restore(ticketId, user.id);
  }
}
