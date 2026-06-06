import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TicketStatus, UserRole } from '../common/enums';

export interface WorkloadRow {
  userId: number;
  username: string;
  openTicketCount: number;
}

@Injectable()
export class WorkloadRepository {
  constructor(private readonly dataSource: DataSource) {}

  async getWorkload(projectId: number): Promise<WorkloadRow[]> {
    const rows = await this.dataSource.query(
      `
      SELECT u.id AS "userId",
             u.username AS username,
             COUNT(t.id) FILTER (
               WHERE t.status != $3 AND t."deletedAt" IS NULL
             )::int AS "openTicketCount"
      FROM project_members pm
      INNER JOIN users u ON u.id = pm."userId" AND u.role = $2
      LEFT JOIN tickets t ON t."assigneeId" = u.id AND t."projectId" = $1
      WHERE pm."projectId" = $1
      GROUP BY u.id, u.username, u."createdAt"
      ORDER BY "openTicketCount" ASC, u."createdAt" ASC
      `,
      [projectId, UserRole.DEVELOPER, TicketStatus.DONE],
    );

    return rows.map((r: { userId: number; username: string; openTicketCount: number }) => ({
      userId: Number(r.userId),
      username: r.username,
      openTicketCount: Number(r.openTicketCount),
    }));
  }
}
