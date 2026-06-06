import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Project } from './entities/project.entity';
import { WorkloadRepository } from './workload.repository';

@Injectable()
export class WorkloadService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly workloadRepository: WorkloadRepository,
  ) {}

  async getWorkload(projectId: number) {
    const project = await this.projectRepository.findOne({
      where: { id: projectId, deletedAt: IsNull() },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return this.workloadRepository.getWorkload(projectId);
  }
}
