import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { EscalationJob } from './escalation.job';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [ScheduleModule.forRoot(), TicketsModule],
  providers: [EscalationJob],
})
export class SchedulerModule {}
