import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, uniqueSuffix } from './helpers/e2e-app';
import { authHeader, loginAs } from './helpers/auth.helpers';
import {
  bootstrapAdmin,
  createDeveloper,
  createProject,
  createTicket,
} from './helpers/fixtures';

describe('Tickets (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const suffix = uniqueSuffix();

  beforeAll(async () => {
    app = await createE2eApp();
    adminToken = await bootstrapAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /tickets?projectId= lists tickets with isOverdue', async () => {
    const project = await createProject(app, adminToken, 1, `Tix ${suffix}`);
    await createTicket(app, adminToken, project.id, {
      dueDate: '2099-01-01T00:00:00Z',
    });
    const res = await request(app.getHttpServer())
      .get(`/tickets?projectId=${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(res.body[0]).toHaveProperty('isOverdue');
  });

  it('ADMIN project ticket without assignee → null (IC-11)', async () => {
    const project = await createProject(app, adminToken, 1, `NoMem ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    expect(ticket.assigneeId).toBeNull();
  });

  it('DEVELOPER owner project auto-assigns to owner', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_aa`);
    const project = await createProject(app, adminToken, dev.id, `Auto ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    expect(ticket.assigneeId).toBe(dev.id);
  });

  it('explicit assigneeId skips auto-assign and links member', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_ex`);
    const project = await createProject(app, adminToken, 1, `Explicit ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id, {
      assigneeId: dev.id,
    });
    expect(ticket.assigneeId).toBe(dev.id);
    const workload = await request(app.getHttpServer())
      .get(`/projects/${project.id}/workload`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(workload.body.some((w: { userId: number }) => w.userId === dev.id)).toBe(true);
  });

  it('manual assignee may be ADMIN (edge #4)', async () => {
    const project = await createProject(app, adminToken, 1, `AdmAsn ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id, {
      assigneeId: 1,
    });
    expect(ticket.assigneeId).toBe(1);
  });

  it('status forward-only; DONE immutable; rejects type on PATCH', async () => {
    const project = await createProject(app, adminToken, 1, `Stat ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'IN_PROGRESS' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'TODO' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .send({ type: 'FEATURE' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'DONE' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .send({ title: 'Nope' })
      .expect(400);
  });

  it('DELETE /tickets/:id soft-deletes; GET deleted list ADMIN only', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_sd`);
    const devToken = await loginAs(app, dev.username);
    const project = await createProject(app, adminToken, 1, `Soft ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    await request(app.getHttpServer())
      .delete(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/tickets/deleted?projectId=${project.id}`)
      .set(authHeader(devToken))
      .expect(403);
    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/restore`)
      .set(authHeader(adminToken))
      .expect(200);
  });

  it('create ticket on soft-deleted project → 404', async () => {
    const project = await createProject(app, adminToken, 1, `Gone ${suffix}`);
    await request(app.getHttpServer())
      .delete(`/projects/${project.id}`)
      .set(authHeader(adminToken));
    await request(app.getHttpServer())
      .post('/tickets')
      .set(authHeader(adminToken))
      .send({
        title: 'X',
        status: 'TODO',
        priority: 'LOW',
        type: 'BUG',
        projectId: project.id,
      })
      .expect(404);
  });
});
