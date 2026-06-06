import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AutoAssignService } from './auto-assign.service';
import { ProjectMembershipService } from '../projects/project-membership.service';
import { Ticket } from './entities/ticket.entity';

describe('AutoAssignService', () => {
  let service: AutoAssignService;
  const members = [
    {
      userId: 2,
      user: { id: 2, createdAt: new Date('2020-01-02') },
    },
    {
      userId: 3,
      user: { id: 3, createdAt: new Date('2020-01-01') },
    },
  ];

  const membershipService = {
    getDeveloperMembers: jest.fn(),
  };
  const ticketRepo = {
    count: jest.fn(),
  };

  beforeEach(async () => {
    membershipService.getDeveloperMembers.mockReset();
    ticketRepo.count.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoAssignService,
        { provide: ProjectMembershipService, useValue: membershipService },
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
      ],
    }).compile();
    service = module.get(AutoAssignService);
  });

  it('returns null when no ProjectMembers (IC-11)', async () => {
    membershipService.getDeveloperMembers.mockResolvedValue([]);
    expect(await service.resolve(1)).toBeNull();
  });

  it('picks least-loaded member; tie-break oldest registration', async () => {
    membershipService.getDeveloperMembers.mockResolvedValue(members);
    ticketRepo.count.mockImplementation(async (opts: { where: { assigneeId: number } }) => {
      if (opts.where.assigneeId === 2) return 1;
      if (opts.where.assigneeId === 3) return 1;
      return 0;
    });
    expect(await service.resolve(1)).toBe(3);
  });
});
