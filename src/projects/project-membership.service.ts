import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProjectMember } from './entities/project-member.entity';
import { UserRole } from '../common/enums';
import { UsersRepository } from '../users/users.repository';

@Injectable()
export class ProjectMembershipService {
  constructor(
    @InjectRepository(ProjectMember)
    private readonly projectMemberRepository: Repository<ProjectMember>,
    private readonly usersRepository: UsersRepository,
  ) {}

  async linkIfDeveloper(projectId: number, userId: number): Promise<void> {
    const user = await this.usersRepository.findById(userId);
    if (!user || user.role !== UserRole.DEVELOPER) {
      return;
    }

    const existing = await this.projectMemberRepository.findOne({
      where: { projectId, userId },
    });
    if (!existing) {
      await this.projectMemberRepository.save({ projectId, userId });
    }
  }

  async getDeveloperMembers(projectId: number): Promise<ProjectMember[]> {
    return this.projectMemberRepository
      .createQueryBuilder('pm')
      .innerJoinAndSelect('pm.user', 'user')
      .where('pm.projectId = :projectId', { projectId })
      .andWhere('user.role = :role', { role: UserRole.DEVELOPER })
      .getMany();
  }
}
