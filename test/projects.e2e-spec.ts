import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, uniqueSuffix } from './helpers/e2e-app';
import { authHeader } from './helpers/auth.helpers';
import {
  bootstrapAdmin,
  createDeveloper,
  createProject,
  createTicket,
} from './helpers/fixtures';

describe('Projects (e2e)', () => {
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

  it('GET /projects lists active projects', async () => {
    const res = await request(app.getHttpServer())
      .get('/projects')
      .set(authHeader(adminToken))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /projects with ADMIN owner does not create ProjectMember', async () => {
    const project = await createProject(app, adminToken, 1, `AdminProj ${suffix}`);
    const workload = await request(app.getHttpServer())
      .get(`/projects/${project.id}/workload`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(workload.body).toEqual([]);
  });

  it('POST /projects with DEVELOPER owner links ProjectMember (IC-11)', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_pown`);
    const project = await createProject(app, adminToken, dev.id, `DevProj ${suffix}`);
    const workload = await request(app.getHttpServer())
      .get(`/projects/${project.id}/workload`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(workload.body).toHaveLength(1);
    expect(workload.body[0].userId).toBe(dev.id);
  });

  it('GET /projects/:id and PATCH /projects/:id', async () => {
    const project = await createProject(app, adminToken, 1, `Patch ${suffix}`);
    await request(app.getHttpServer())
      .get(`/projects/${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${project.id}`)
      .set(authHeader(adminToken))
      .send({ name: 'Updated' })
      .expect(200);
  });

  it('DELETE /projects/:id cascades tickets; soft-deleted hidden', async () => {
    const project = await createProject(app, adminToken, 1, `Del ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    await request(app.getHttpServer())
      .delete(`/projects/${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .get(`/projects/${project.id}`)
      .set(authHeader(adminToken))
      .expect(404);
    await request(app.getHttpServer())
      .get(`/tickets?projectId=${project.id}`)
      .set(authHeader(adminToken))
      .expect(404);
  });

  it('GET /projects/deleted and restore — ADMIN only (PD-02)', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_rest`);
    const devToken = await (await import('./helpers/auth.helpers')).loginAs(
      app,
      dev.username,
    );
    const project = await createProject(app, adminToken, 1, `Restore ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    await request(app.getHttpServer())
      .delete(`/projects/${project.id}`)
      .set(authHeader(adminToken));

    await request(app.getHttpServer())
      .get('/projects/deleted')
      .set(authHeader(devToken))
      .expect(403);

    const deleted = await request(app.getHttpServer())
      .get('/projects/deleted')
      .set(authHeader(adminToken))
      .expect(200);
    expect(deleted.body.some((p: { id: number }) => p.id === project.id)).toBe(true);

    await request(app.getHttpServer())
      .post(`/projects/${project.id}/restore`)
      .set(authHeader(adminToken))
      .expect(200);

    const tickets = await request(app.getHttpServer())
      .get(`/tickets?projectId=${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(tickets.body.some((t: { id: number }) => t.id === ticket.id)).toBe(true);
  });

  it('GET /projects/:id/workload sorted by openTicketCount (IC-11)', async () => {
    const dev1 = await createDeveloper(app, adminToken, `${suffix}_w1`);
    const dev2 = await createDeveloper(app, adminToken, `${suffix}_w2`);
    const project = await createProject(app, adminToken, dev1.id, `Work ${suffix}`);
    await createTicket(app, adminToken, project.id, { assigneeId: dev2.id });
    await createTicket(app, adminToken, project.id, { assigneeId: dev2.id });
    await createTicket(app, adminToken, project.id, { assigneeId: dev1.id });

    const workload = await request(app.getHttpServer())
      .get(`/projects/${project.id}/workload`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(workload.body).toHaveLength(2);
    expect(workload.body[0].openTicketCount).toBeLessThanOrEqual(
      workload.body[1].openTicketCount,
    );
  });
});
