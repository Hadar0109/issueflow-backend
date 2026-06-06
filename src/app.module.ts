import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import configuration from './config/configuration';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TicketsModule } from './tickets/tickets.module';
import { CommentsModule } from './comments/comments.module';
import { DependenciesModule } from './dependencies/dependencies.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { SchedulerModule } from './scheduler/scheduler.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    CommonModule,
    AuditModule,
    AuthModule,
    UsersModule,
    ProjectsModule,
    TicketsModule,
    CommentsModule,
    DependenciesModule,
    AttachmentsModule,
    SchedulerModule,
  ],
})
export class AppModule {}
