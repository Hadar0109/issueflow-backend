import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketEscalationService } from './ticket-escalation.service';
import { Ticket } from './entities/ticket.entity';
import { CLOCK } from '../common/utils/clock';
import { AuditService } from '../audit/audit.service';
import { TicketPriority, TicketStatus } from '../common/enums';

describe('TicketEscalationService', () => {
  let service: TicketEscalationService;
  const now = new Date('2026-06-01T00:00:00Z');
  const tickets: Ticket[] = [];
  const ticketRepo = {
    find: jest.fn(async () => tickets),
    save: jest.fn(async (t: Ticket) => t),
  };
  const audit = { log: jest.fn() };

  beforeEach(async () => {
    tickets.length = 0;
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketEscalationService,
        { provide: getRepositoryToken(Ticket), useValue: ticketRepo },
        { provide: CLOCK, useValue: { now: () => now } },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = module.get(TicketEscalationService);
  });

  it('escalates LOW one step when overdue', async () => {
    tickets.push({
      id: 1,
      priority: TicketPriority.LOW,
      status: TicketStatus.TODO,
      dueDate: new Date('2026-05-01T00:00:00Z'),
      isOverdue: false,
    } as Ticket);
    await service.processOverdueTickets();
    expect(tickets[0].priority).toBe(TicketPriority.MEDIUM);
    expect(audit.log).toHaveBeenCalled();
  });

  it('CRITICAL overdue sets isOverdue without changing priority', async () => {
    tickets.push({
      id: 2,
      priority: TicketPriority.CRITICAL,
      status: TicketStatus.IN_PROGRESS,
      dueDate: new Date('2026-05-01T00:00:00Z'),
      isOverdue: false,
    } as Ticket);
    await service.processOverdueTickets();
    expect(tickets[0].priority).toBe(TicketPriority.CRITICAL);
    expect(tickets[0].isOverdue).toBe(true);
  });

  it('skips DONE tickets', async () => {
    tickets.push({
      id: 3,
      priority: TicketPriority.LOW,
      status: TicketStatus.DONE,
      dueDate: new Date('2026-05-01T00:00:00Z'),
      isOverdue: false,
    } as Ticket);
    const count = await service.processOverdueTickets();
    expect(count).toBe(0);
  });
});
