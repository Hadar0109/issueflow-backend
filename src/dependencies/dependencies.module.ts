import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TicketDependency } from './entities/ticket-dependency.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { DependenciesController } from './dependencies.controller';
import { DependenciesService } from './dependencies.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([TicketDependency, Ticket]), AuditModule],
  controllers: [DependenciesController],
  providers: [DependenciesService],
})
export class DependenciesModule {}
