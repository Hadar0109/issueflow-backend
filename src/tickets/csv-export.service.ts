import { Injectable } from '@nestjs/common';
import { stringify } from 'csv-stringify/sync';
import { TicketsRepository } from './tickets.repository';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class CsvExportService {
  constructor(
    private readonly ticketsRepository: TicketsRepository,
    private readonly projectsService: ProjectsService,
  ) {}

  async export(projectId: number): Promise<string> {
    await this.projectsService.assertActiveProject(projectId);
    const tickets = await this.ticketsRepository.findActiveByProject(projectId);

    const rows = tickets.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      type: t.type,
      assigneeId: t.assigneeId ?? '',
    }));

    return stringify(rows, {
      header: true,
      columns: ['id', 'title', 'description', 'status', 'priority', 'type', 'assigneeId'],
      quoted: true,
      quoted_empty: true,
    });
  }
}
