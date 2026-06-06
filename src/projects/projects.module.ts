import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './entities/project.entity';
import { ProjectMember } from './entities/project-member.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectMembershipService } from './project-membership.service';
import { WorkloadService } from './workload.service';
import { WorkloadRepository } from './workload.repository';
import { UsersModule } from '../users/users.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectMember, Ticket]),
    UsersModule,
    AuditModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectMembershipService,
    WorkloadService,
    WorkloadRepository,
  ],
  exports: [ProjectsService, ProjectMembershipService],
})
export class ProjectsModule {}
