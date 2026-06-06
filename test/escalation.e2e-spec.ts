import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ValidationPipe } from '@nestjs/common';
import { CLOCK, Clock } from '../src/common/utils/clock';
import { Ticket } from '../src/tickets/entities/ticket.entity';
import { TicketEscalationService } from '../src/tickets/ticket-escalation.service';
import { authHeader } from './helpers/auth.helpers';
import { bootstrapAdmin, createProject } from './helpers/fixtures';
import { uniqueSuffix } from './helpers/e2e-app';

class FixedClock implements Clock {
  constructor(private readonly fixed: Date) {}
  now(): Date {
    return this.fixed;
  }
}

describe('Escalation (e2e) — IC-07', () => {
  let app: INestApplication;
  let adminToken: string;
  let ticketRepo: Repository<Ticket>;
  let escalationService: TicketEscalationService;
  let clock: FixedClock;
  const suffix = uniqueSuffix();

  beforeAll(async () => {
    clock = new FixedClock(new Date('2026-01-15T12:00:00Z'));
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    adminToken = await bootstrapAdmin(app);
    ticketRepo = moduleFixture.get(getRepositoryToken(Ticket));
    escalationService = moduleFixture.get(TicketEscalationService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('overdue LOW ticket escalates one priority step', async () => {
    const project = await createProject(app, adminToken, 1, `Esc ${suffix}`);
    const created = await request(app.getHttpServer())
      .post('/tickets')
      .set(authHeader(adminToken))
      .send({
        title: 'Overdue',
        status: 'TODO',
        priority: 'LOW',
        type: 'BUG',
        projectId: project.id,
        dueDate: '2026-01-01T00:00:00Z',
      })
      .expect(200);

    await escalationService.processOverdueTickets();

    const ticket = await ticketRepo.findOne({ where: { id: created.body.id } });
    expect(ticket.priority).toBe('MEDIUM');
    expect(ticket.isOverdue).toBe(false);

    const logs = await request(app.getHttpServer())
      .get(`/audit-logs?entityType=TICKET&entityId=${created.body.id}&action=ESCALATE`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(logs.body.some((l: { actor: string }) => l.actor === 'SYSTEM')).toBe(true);
  });

  it('CRITICAL overdue sets isOverdue; manual priority PATCH clears it', async () => {
    const project = await createProject(app, adminToken, 1, `Crit ${suffix}`);
    const created = await request(app.getHttpServer())
      .post('/tickets')
      .set(authHeader(adminToken))
      .send({
        title: 'Critical overdue',
        status: 'TODO',
        priority: 'CRITICAL',
        type: 'BUG',
        projectId: project.id,
        dueDate: '2026-01-01T00:00:00Z',
      })
      .expect(200);

    await escalationService.processOverdueTickets();
    let ticket = await ticketRepo.findOne({ where: { id: created.body.id } });
    expect(ticket.priority).toBe('CRITICAL');
    expect(ticket.isOverdue).toBe(true);

    await request(app.getHttpServer())
      .patch(`/tickets/${created.body.id}`)
      .set(authHeader(adminToken))
      .send({ priority: 'HIGH' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/tickets/${created.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(res.body.isOverdue).toBe(false);
  });
});
