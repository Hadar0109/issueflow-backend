import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from './entities/ticket.entity';
import { TicketDependency } from '../dependencies/entities/ticket-dependency.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsRepository } from './tickets.repository';
import { TicketStatusService } from './ticket-status.service';
import { AutoAssignService } from './auto-assign.service';
import { TicketEscalationService } from './ticket-escalation.service';
import { CsvExportService } from './csv-export.service';
import { CsvImportService } from './csv-import.service';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketDependency]),
    ProjectsModule,
    UsersModule,
    AuditModule,
  ],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsRepository,
    TicketStatusService,
    AutoAssignService,
    TicketEscalationService,
    CsvExportService,
    CsvImportService,
  ],
  exports: [TicketsService, TicketEscalationService],
})
export class TicketsModule {}
