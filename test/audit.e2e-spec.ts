import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, uniqueSuffix } from './helpers/e2e-app';
import { authHeader } from './helpers/auth.helpers';
import { bootstrapAdmin, createDeveloper, createProject, createTicket } from './helpers/fixtures';

describe('Audit (e2e)', () => {
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

  it('ticket CREATE and AUTO_ASSIGN appear in audit log', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_aud`);
    const project = await createProject(app, adminToken, dev.id, `Aud ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);

    const logs = await request(app.getHttpServer())
      .get(`/audit-logs?entityType=TICKET&entityId=${ticket.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(logs.body.some((l: { action: string }) => l.action === 'CREATE')).toBe(true);
    expect(
      logs.body.some(
        (l: { action: string; actor: string }) =>
          l.action === 'AUTO_ASSIGN' && l.actor === 'SYSTEM',
      ),
    ).toBe(true);
  });

  it('project delete emits cascade SOFT_DELETE ticket audits', async () => {
    const project = await createProject(app, adminToken, 1, `AudDel ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    await request(app.getHttpServer())
      .delete(`/projects/${project.id}`)
      .set(authHeader(adminToken));

    const logs = await request(app.getHttpServer())
      .get(`/audit-logs?entityType=TICKET&entityId=${ticket.id}&action=SOFT_DELETE`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(logs.body.length).toBeGreaterThan(0);
    expect(logs.body[0].metadata?.cascade).toBe(true);
  });

  it('GET /audit-logs filters by action and actor', async () => {
    const res = await request(app.getHttpServer())
      .get('/audit-logs?action=CREATE&actor=USER')
      .set(authHeader(adminToken))
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    if (res.body.length > 0) {
      expect(res.body[0].action).toBe('CREATE');
      expect(res.body[0].actor).toBe('USER');
    }
  });
});
