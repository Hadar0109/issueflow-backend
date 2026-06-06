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

describe('Concurrency (e2e) — IC-10', () => {
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

  it('concurrent ticket PATCH → one 200 and one 409', async () => {
    const project = await createProject(app, adminToken, 1, `Conc ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);

    const patch = () =>
      request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}`)
        .set(authHeader(adminToken))
        .send({ description: `patch-${Math.random()}` });

    const [r1, r2] = await Promise.all([patch(), patch()]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });

  it('concurrent comment PATCH → one 200 and one 409', async () => {
    const author = await createDeveloper(app, adminToken, `${suffix}_cc`);
    const project = await createProject(app, adminToken, 1, `ConcC ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    const authorToken = await loginAs(app, author.username);

    const created = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(authorToken))
      .send({ authorId: author.id, content: 'Original' })
      .expect(200);

    const patch = () =>
      request(app.getHttpServer())
        .patch(`/tickets/${ticket.id}/comments/${created.body.id}`)
        .set(authHeader(authorToken))
        .send({ content: `edit-${Math.random()}` });

    const [r1, r2] = await Promise.all([patch(), patch()]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});
