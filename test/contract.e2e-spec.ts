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

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/**
 * Minimum happy-path sweep of all 36 README endpoint groups.
 */
describe('Contract sweep (e2e)', () => {
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

  it('covers all documented routes with at least one 200', async () => {
    const server = app.getHttpServer();

    // Auth
    const login = await request(server)
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    expect(login.body.accessToken).toBeDefined();

    await request(server).get('/auth/me').set(authHeader(adminToken)).expect(200);

    // Users
    await request(server).get('/users').set(authHeader(adminToken)).expect(200);
    const dev = await createDeveloper(app, adminToken, `${suffix}_ctr`);
    await request(server).get(`/users/${dev.id}`).set(authHeader(adminToken)).expect(200);
    await request(server)
      .post(`/users/update/${dev.id}`)
      .set(authHeader(adminToken))
      .send({ fullName: 'Contract' })
      .expect(200);

    // Projects
    await request(server).get('/projects').set(authHeader(adminToken)).expect(200);
    const project = await createProject(app, adminToken, dev.id, `Ctr ${suffix}`);
    await request(server)
      .get(`/projects/${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(server)
      .patch(`/projects/${project.id}`)
      .set(authHeader(adminToken))
      .send({ description: 'd' })
      .expect(200);
    await request(server)
      .get(`/projects/${project.id}/workload`)
      .set(authHeader(adminToken))
      .expect(200);

    // Tickets
    const ticket = await createTicket(app, adminToken, project.id);
    await request(server)
      .get(`/tickets?projectId=${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(server)
      .get(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(server)
      .patch(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .send({ description: 'd' })
      .expect(200);
    await request(server)
      .get(`/tickets/export?projectId=${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    const csv = 'title,description,status,priority,type,assigneeId\nCtr,,,,,\n';
    await request(server)
      .post('/tickets/import')
      .set(authHeader(adminToken))
      .field('projectId', project.id)
      .attach('file', Buffer.from(csv), 'c.csv')
      .expect(200);

    // Comments
    const devToken = await loginAs(app, dev.username);
    const comment = await request(server)
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(devToken))
      .send({ authorId: dev.id, content: `@${dev.username}` })
      .expect(200);
    await request(server)
      .get(`/tickets/${ticket.id}/comments`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(server)
      .patch(`/tickets/${ticket.id}/comments/${comment.body.id}`)
      .set(authHeader(devToken))
      .send({ content: 'updated' })
      .expect(200);

    // Mentions
    await request(server)
      .get(`/users/${dev.id}/mentions`)
      .set(authHeader(adminToken))
      .expect(200);

    // Dependencies
    const blocker = await createTicket(app, adminToken, project.id);
    await request(server)
      .post(`/tickets/${ticket.id}/dependencies`)
      .set(authHeader(adminToken))
      .send({ blockedBy: blocker.id })
      .expect(200);
    await request(server)
      .get(`/tickets/${ticket.id}/dependencies`)
      .set(authHeader(adminToken))
      .expect(200);

    // Attachments
    const att = await request(server)
      .post(`/tickets/${ticket.id}/attachments`)
      .set(authHeader(adminToken))
      .attach('file', PNG, { filename: 'c.png', contentType: 'image/png' })
      .expect(200);

    // Audit
    await request(server).get('/audit-logs').set(authHeader(adminToken)).expect(200);

    // Soft delete admin surfaces
    await request(server).get('/projects/deleted').set(authHeader(adminToken)).expect(200);
    await request(server)
      .get(`/tickets/deleted?projectId=${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);

    // Cleanup deletes (happy 200)
    await request(server)
      .delete(`/tickets/${ticket.id}/attachments/${att.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(server)
      .delete(`/tickets/${ticket.id}/dependencies/${blocker.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(server)
      .delete(`/tickets/${ticket.id}/comments/${comment.body.id}`)
      .set(authHeader(devToken))
      .expect(200);
    await request(server)
      .delete(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(server)
      .post(`/tickets/${ticket.id}/restore`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(server)
      .delete(`/projects/${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    await request(server)
      .post(`/projects/${project.id}/restore`)
      .set(authHeader(adminToken))
      .expect(200);

    await request(server).post('/auth/logout').set(authHeader(adminToken)).expect(200);
  });
});
