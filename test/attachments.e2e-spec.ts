import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, uniqueSuffix } from './helpers/e2e-app';
import { authHeader } from './helpers/auth.helpers';
import { bootstrapAdmin, createProject, createTicket } from './helpers/fixtures';

// Minimal valid PNG (1x1)
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Attachments (e2e)', () => {
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

  it('POST valid PNG attachment → 200', async () => {
    const project = await createProject(app, adminToken, 1, `Att ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/attachments`)
      .set(authHeader(adminToken))
      .attach('file', PNG_BUFFER, { filename: 'test.png', contentType: 'image/png' })
      .expect(200);
    expect(res.body.filename).toBe('test.png');
    expect(res.body.contentType).toBe('image/png');

    await request(app.getHttpServer())
      .delete(`/tickets/${ticket.id}/attachments/${res.body.id}`)
      .set(authHeader(adminToken))
      .expect(200);
  });

  it('oversize file → 400', async () => {
    const project = await createProject(app, adminToken, 1, `Big ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    const big = Buffer.alloc(11 * 1024 * 1024);
    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/attachments`)
      .set(authHeader(adminToken))
      .attach('file', big, { filename: 'big.png', contentType: 'image/png' });
    expect([400, 413]).toContain(res.status);
  });

  it('upload on soft-deleted ticket → 404', async () => {
    const project = await createProject(app, adminToken, 1, `AttDel ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    await request(app.getHttpServer())
      .delete(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken));
    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/attachments`)
      .set(authHeader(adminToken))
      .attach('file', PNG_BUFFER, { filename: 'x.png', contentType: 'image/png' })
      .expect(404);
  });
});
