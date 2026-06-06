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

describe('Import/Export (e2e)', () => {
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

  it('export empty project → header only CSV', async () => {
    const project = await createProject(app, adminToken, 1, `Exp ${suffix}`);
    const res = await request(app.getHttpServer())
      .get(`/tickets/export?projectId=${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    const lines = res.text.trim().split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('title');
  });

  it('export quotes commas in title', async () => {
    const project = await createProject(app, adminToken, 1, `Comma ${suffix}`);
    await createTicket(app, adminToken, project.id, { title: 'Bug, urgent' });
    const res = await request(app.getHttpServer())
      .get(`/tickets/export?projectId=${project.id}`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(res.text).toContain('"Bug, urgent"');
  });

  it('import partial success and header-only CSV', async () => {
    const project = await createProject(app, adminToken, 1, `Imp ${suffix}`);
    const csv = [
      'title,description,status,priority,type,assigneeId',
      'Valid row,,,,,',
      ',missing title,,,,',
    ].join('\n');

    const res = await request(app.getHttpServer())
      .post('/tickets/import')
      .set(authHeader(adminToken))
      .field('projectId', project.id)
      .attach('file', Buffer.from(csv), 'import.csv')
      .expect(200);
    expect(res.body.created).toBe(1);
    expect(res.body.failed).toBe(1);
    expect(res.body.errors.length).toBe(1);

    const headerOnly = 'title,description,status,priority,type,assigneeId\n';
    const empty = await request(app.getHttpServer())
      .post('/tickets/import')
      .set(authHeader(adminToken))
      .field('projectId', project.id)
      .attach('file', Buffer.from(headerOnly), 'empty.csv')
      .expect(200);
    expect(empty.body.created).toBe(0);
  });

  it('import with explicit assigneeId links DEVELOPER member', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_imp`);
    const project = await createProject(app, adminToken, 1, `ImpDev ${suffix}`);
    const csv = `title,description,status,priority,type,assigneeId\nRow,,,,,${dev.id}\n`;
    await request(app.getHttpServer())
      .post('/tickets/import')
      .set(authHeader(adminToken))
      .field('projectId', project.id)
      .attach('file', Buffer.from(csv), 'dev.csv')
      .expect(200);
    const workload = await request(app.getHttpServer())
      .get(`/projects/${project.id}/workload`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(workload.body.some((w: { userId: number }) => w.userId === dev.id)).toBe(true);
  });
});
