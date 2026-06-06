import { Injectable } from '@nestjs/common';
import { ProjectMembershipService } from '../projects/project-membership.service';
import { TicketStatus } from '../common/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class AutoAssignService {
  constructor(
    private readonly projectMembershipService: ProjectMembershipService,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
  ) {}

  async resolve(projectId: number): Promise<number | null> {
    const members = await this.projectMembershipService.getDeveloperMembers(projectId);
    if (members.length === 0) {
      return null;
    }

    let bestUserId: number | null = null;
    let bestCount = Infinity;
    let bestCreatedAt = new Date();

    for (const member of members) {
      const count = await this.ticketRepository.count({
        where: {
          projectId,
          assigneeId: member.userId,
          deletedAt: IsNull(),
          status: TicketStatus.TODO as TicketStatus,
        },
      });
      const inProgress = await this.ticketRepository.count({
        where: {
          projectId,
          assigneeId: member.userId,
          deletedAt: IsNull(),
          status: TicketStatus.IN_PROGRESS,
        },
      });
      const inReview = await this.ticketRepository.count({
        where: {
          projectId,
          assigneeId: member.userId,
          deletedAt: IsNull(),
          status: TicketStatus.IN_REVIEW,
        },
      });
      const openCount = count + inProgress + inReview;

      if (
        openCount < bestCount ||
        (openCount === bestCount && member.user.createdAt < bestCreatedAt)
      ) {
        bestCount = openCount;
        bestUserId = member.userId;
        bestCreatedAt = member.user.createdAt;
      }
    }

    return bestUserId;
  }
}
