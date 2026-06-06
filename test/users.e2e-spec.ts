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

describe('Users (e2e)', () => {
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

  it('GET /users returns list', async () => {
    const res = await request(app.getHttpServer())
      .get('/users')
      .set(authHeader(adminToken))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /users creates DEVELOPER and can login (PD-09)', async () => {
    const dev = await createDeveloper(app, adminToken, suffix);
    expect(dev.role).toBe('DEVELOPER');
    await loginAs(app, dev.username);
  });

  it('POST /users rejects username with whitespace', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .set(authHeader(adminToken))
      .send({
        username: 'john doe',
        email: `bad_${suffix}@example.com`,
        fullName: 'Bad User',
        role: 'DEVELOPER',
      })
      .expect(400);
  });

  it('GET /users/:userId returns user or 404', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_g`);
    await request(app.getHttpServer())
      .get(`/users/${dev.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(app.getHttpServer())
      .get('/users/999999')
      .set(authHeader(adminToken))
      .expect(404);
  });

  it('POST /users/update/:userId updates user; empty body → 400', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_u`);
    const res = await request(app.getHttpServer())
      .post(`/users/update/${dev.id}`)
      .set(authHeader(adminToken))
      .send({ fullName: 'Updated Name' })
      .expect(200);
    expect(res.body.fullName).toBe('Updated Name');

    await request(app.getHttpServer())
      .post(`/users/update/${dev.id}`)
      .set(authHeader(adminToken))
      .send({})
      .expect(400);
  });

  it('POST /users duplicate username/email returns 409', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_dup`);
    await request(app.getHttpServer())
      .post('/users')
      .set(authHeader(adminToken))
      .send({
        username: dev.username.toUpperCase(),
        email: `other_${suffix}@example.com`,
        fullName: 'Other',
        role: 'DEVELOPER',
      })
      .expect(409);

    await request(app.getHttpServer())
      .post('/users')
      .set(authHeader(adminToken))
      .send({
        username: `other2_${suffix}`,
        email: dev.email.toUpperCase(),
        fullName: 'Other2',
        role: 'DEVELOPER',
      })
      .expect(409);
  });

  it('DELETE /users/:id blocked when user owns project (BR-14)', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_own`);
    await createProject(app, adminToken, dev.id, `Own ${suffix}`);
    await request(app.getHttpServer())
      .delete(`/users/${dev.id}`)
      .set(authHeader(adminToken))
      .expect(409);
  });

  it('DELETE /users/:id blocked when assignee on non-DONE ticket (BR-14)', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_asn`);
    const project = await createProject(app, adminToken, 1, `AsnProj ${suffix}`);
    await createTicket(app, adminToken, project.id, {
      assigneeId: dev.id,
      status: 'IN_PROGRESS',
    });
    await request(app.getHttpServer())
      .delete(`/users/${dev.id}`)
      .set(authHeader(adminToken))
      .expect(409);
  });

  it('DELETE /users/:id cascades comments; audit performedBy retained (BR-18, PD-10)', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_del`);
    const project = await createProject(app, adminToken, 1, `DelProj ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id, {
      assigneeId: dev.id,
      status: 'DONE',
    });
    const devToken = await loginAs(app, dev.username);
    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(devToken))
      .send({ authorId: dev.id, content: 'Cascade comment' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/users/${dev.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/users/${dev.id}`)
      .set(authHeader(adminToken))
      .expect(404);

    const comments = await request(app.getHttpServer())
      .get(`/tickets/${ticket.id}/comments`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(comments.body).toEqual([]);

    const audit = await request(app.getHttpServer())
      .get('/audit-logs?entityType=USER&action=DELETE')
      .set(authHeader(adminToken))
      .expect(200);
    const deleteEntry = audit.body.find(
      (e: { entityId: number }) => e.entityId === dev.id,
    );
    expect(deleteEntry).toBeDefined();
    expect(deleteEntry.performedBy).toBe(1);

    await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(devToken))
      .expect(401);
  });
});
