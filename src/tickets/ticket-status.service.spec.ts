import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TicketStatusService } from './ticket-status.service';
import { TicketDependency } from '../dependencies/entities/ticket-dependency.entity';
import { TicketStatus } from '../common/enums';
import { Ticket } from './entities/ticket.entity';

describe('TicketStatusService', () => {
  let service: TicketStatusService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketStatusService,
        { provide: getRepositoryToken(TicketDependency), useValue: { createQueryBuilder: jest.fn() } },
      ],
    }).compile();
    service = module.get(TicketStatusService);
  });

  it('rejects backward status transition', () => {
    expect(() =>
      service.validateTransition(TicketStatus.IN_PROGRESS, TicketStatus.TODO),
    ).toThrow(BadRequestException);
  });

  it('allows forward status transition', () => {
    expect(() =>
      service.validateTransition(TicketStatus.TODO, TicketStatus.IN_PROGRESS),
    ).not.toThrow();
  });

  it('rejects modification of DONE ticket', () => {
    const ticket = { status: TicketStatus.DONE } as Ticket;
    expect(() => service.assertNotDone(ticket)).toThrow(BadRequestException);
  });
});
