import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CsvImportService } from './csv-import.service';
import { Ticket } from './entities/ticket.entity';
import { ProjectsService } from '../projects/projects.service';
import { ProjectMembershipService } from '../projects/project-membership.service';
import { AutoAssignService } from './auto-assign.service';
import { UsersRepository } from '../users/users.repository';
import { AuditService } from '../audit/audit.service';

describe('CsvImportService', () => {
  let service: CsvImportService;
  const ticketRepo = { save: jest.fn().mockImplementation((t) => ({ id: 99, ...t })) };
  const projectsService = { assertActiveProject: jest.fn() };
  const membershipService = { linkIfDeveloper: jest.fn() };
  const autoAssign = { resolve: jest.fn().mockResolvedValue(null) };
  const usersRepo = { findById: jest.fn() };
  const audit = { log: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CsvImportService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: ProjectsService, useValue: projectsService },
        { provide: ProjectMembershipService, useValue: membershipService },
        { provide: AutoAssignService, useValue: autoAssign },
        { provide: UsersRepository, useValue: usersRepo },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(CsvImportService);
  });

  it('header-only CSV returns created: 0', async () => {
    const csv = Buffer.from('title,description,status,priority,type,assigneeId\n');
    const result = await service.importCsv(csv, 1, 1);
    expect(result).toEqual({ created: 0, failed: 0, errors: [] });
  });

  it('blank title row fails; valid row uses defaults (PD-01)', async () => {
    const csv = Buffer.from(
      'title,description,status,priority,type,assigneeId\n' +
        'Good title,,,,,\n' +
        ',,,,,\n',
    );
    const result = await service.importCsv(csv, 1, 1);
    expect(result.created).toBe(1);
    expect(result.failed).toBe(1);
    expect(ticketRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'TODO',
        priority: 'MEDIUM',
        type: 'BUG',
      }),
    );
  });
});
