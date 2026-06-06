import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMember } from './entities/project-member.entity';
import { UserRole, TicketStatus } from '../common/enums';

export interface WorkloadRow {
  userId: number;
  username: string;
  openTicketCount: number;
}

@Injectable()
export class WorkloadRepository {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
  ) {}

  async getWorkload(projectId: number): Promise<WorkloadRow[]> {
    const rows = await this.projectMemberRepository
      .createQueryBuilder('pm')
      .innerJoin('pm.user', 'u')
      .leftJoin(
        'tickets',
        't',
        't.assigneeId = u.id AND t.projectId = :projectId AND t.deletedAt IS NULL AND t.status != :done',
        { projectId, done: TicketStatus.DONE },
      )
      .select('u.id', 'userId')
      .addSelect('u.username', 'username')
      .addSelect('u.createdAt', 'createdAt')
      .addSelect('COUNT(t.id)', 'openTicketCount')
      .where('pm.projectId = :projectId', { projectId })
      .andWhere('u.role = :role', { role: UserRole.DEVELOPER })
      .groupBy('u.id')
      .addGroupBy('u.username')
      .addGroupBy('u.createdAt')
      .orderBy('openTicketCount', 'ASC')
      .addOrderBy('u.createdAt', 'ASC')
      .getRawMany();

    return rows.map((r) => ({
      userId: Number(r.userId),
      username: r.username,
      openTicketCount: Number(r.openTicketCount),
    }));
  }
}
