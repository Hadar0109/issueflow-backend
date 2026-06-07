import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { TransactionRunner } from '../common/database/transaction-runner';
import { AuditService } from '../audit/audit.service';
import { Project } from '../projects/entities/project.entity';
import { Ticket } from '../tickets/entities/ticket.entity';
import { Comment } from '../comments/entities/comment.entity';
import { Mention } from '../comments/entities/mention.entity';
import { ProjectMember } from '../projects/entities/project-member.entity';
import { User } from './entities/user.entity';
import { TicketStatus } from '../common/enums';

describe('UsersService.delete', () => {
  let service: UsersService;
  const usersRepo = {
    findById: jest.fn(),
    save: jest.fn(),
    findAll: jest.fn(),
    findByUsernameCi: jest.fn(),
    findByEmailCi: jest.fn(),
    remove: jest.fn(),
  };
  const projectRepo = { count: jest.fn() };
  const ticketRepo = { count: jest.fn() };
  const audit = { log: jest.fn() };
  const manager = {
    find: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    update: jest.fn(),
  };
  const transactionRunner = {
    run: jest.fn(async (fn: (m: typeof manager) => Promise<void>) => fn(manager)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: usersRepo },
        { provide: TransactionRunner, useValue: transactionRunner },
        { provide: AuditService, useValue: audit },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: getRepositoryToken(Comment), useValue: {} },
        { provide: getRepositoryToken(Mention), useValue: {} },
        { provide: getRepositoryToken(ProjectMember), useValue: {} },
      ],
    }).compile();
    service = module.get(UsersService);
  });

  it('blocks delete when user owns project (BR-14)', async () => {
    usersRepo.findById.mockResolvedValue({ id: 5 } as User);
    projectRepo.count.mockResolvedValue(1);
    await expect(service.delete(5, 1)).rejects.toThrow(ConflictException);
  });

  it('blocks delete when assignee on non-DONE ticket (BR-14)', async () => {
    usersRepo.findById.mockResolvedValue({ id: 5 } as User);
    projectRepo.count.mockResolvedValue(0);
    ticketRepo.count.mockResolvedValue(1);
    await expect(service.delete(5, 1)).rejects.toThrow(ConflictException);
    expect(ticketRepo.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assigneeId: 5 }) }),
    );
  });

  it('hard-deletes user when guards pass (BR-18)', async () => {
    usersRepo.findById.mockResolvedValue({ id: 5 } as User);
    projectRepo.count.mockResolvedValue(0);
    ticketRepo.count.mockResolvedValue(0);
    await service.delete(5, 1);
    expect(manager.delete).toHaveBeenCalledWith(User, { id: 5 });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE', entityType: 'USER', entityId: 5 }),
    );
  });
});
