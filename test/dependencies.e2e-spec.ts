import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, uniqueSuffix } from './helpers/e2e-app';
import { authHeader } from './helpers/auth.helpers';
import { bootstrapAdmin, createProject, createTicket } from './helpers/fixtures';

describe('Dependencies (e2e)', () => {
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

  it('POST dependency same project → 200; self/cross-project → 400', async () => {
    const p1 = await createProject(app, adminToken, 1, `Dep1 ${suffix}`);
    const p2 = await createProject(app, adminToken, 1, `Dep2 ${suffix}`);
    const blocked = await createTicket(app, adminToken, p1.id);
    const blocker = await createTicket(app, adminToken, p1.id);
    const other = await createTicket(app, adminToken, p2.id);

    await request(app.getHttpServer())
      .post(`/tickets/${blocked.id}/dependencies`)
      .set(authHeader(adminToken))
      .send({ blockedBy: blocker.id })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/tickets/${blocked.id}/dependencies`)
      .set(authHeader(adminToken))
      .send({ blockedBy: blocked.id })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/tickets/${blocked.id}/dependencies`)
      .set(authHeader(adminToken))
      .send({ blockedBy: other.id })
      .expect(400);
  });

  it('DONE blocked by open direct blocker → 400', async () => {
    const project = await createProject(app, adminToken, 1, `DoneBlk ${suffix}`);
    const blocked = await createTicket(app, adminToken, project.id, { status: 'IN_PROGRESS' });
    const blocker = await createTicket(app, adminToken, project.id, { status: 'TODO' });
    await request(app.getHttpServer())
      .post(`/tickets/${blocked.id}/dependencies`)
      .set(authHeader(adminToken))
      .send({ blockedBy: blocker.id });
    await request(app.getHttpServer())
      .patch(`/tickets/${blocked.id}`)
      .set(authHeader(adminToken))
      .send({ status: 'DONE' })
      .expect(400);
  });

  it('circular dependency allowed; GET lists blockers', async () => {
    const project = await createProject(app, adminToken, 1, `Circ ${suffix}`);
    const t1 = await createTicket(app, adminToken, project.id);
    const t2 = await createTicket(app, adminToken, project.id);
    await request(app.getHttpServer())
      .post(`/tickets/${t1.id}/dependencies`)
      .set(authHeader(adminToken))
      .send({ blockedBy: t2.id });
    await request(app.getHttpServer())
      .post(`/tickets/${t2.id}/dependencies`)
      .set(authHeader(adminToken))
      .send({ blockedBy: t1.id })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get(`/tickets/${t1.id}/dependencies`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(list.body.some((d: { id: number }) => d.id === t2.id)).toBe(true);
  });

  it('DELETE dependency', async () => {
    const project = await createProject(app, adminToken, 1, `RmDep ${suffix}`);
    const blocked = await createTicket(app, adminToken, project.id);
    const blocker = await createTicket(app, adminToken, project.id);
    await request(app.getHttpServer())
      .post(`/tickets/${blocked.id}/dependencies`)
      .set(authHeader(adminToken))
      .send({ blockedBy: blocker.id });
    await request(app.getHttpServer())
      .delete(`/tickets/${blocked.id}/dependencies/${blocker.id}`)
      .set(authHeader(adminToken))
      .expect(200);
  });
});
