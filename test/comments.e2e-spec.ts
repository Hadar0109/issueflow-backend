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

describe('Comments (e2e)', () => {
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

  it('POST comment with @mention resolves user; unknown ignored', async () => {
    const mentioned = await createDeveloper(app, adminToken, `${suffix}_men`);
    const author = await createDeveloper(app, adminToken, `${suffix}_auth`);
    const project = await createProject(app, adminToken, 1, `Cmt ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    const authorToken = await loginAs(app, author.username);

    const res = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(authorToken))
      .send({
        authorId: author.id,
        content: `Hello @${mentioned.username} and @nobody`,
      })
      .expect(200);
    expect(res.body.mentionedUsers).toHaveLength(1);
    expect(res.body.mentionedUsers[0].username).toBe(mentioned.username);
  });

  it('authorId mismatch JWT → 400', async () => {
    const author = await createDeveloper(app, adminToken, `${suffix}_mis`);
    const other = await createDeveloper(app, adminToken, `${suffix}_oth`);
    const project = await createProject(app, adminToken, 1, `Mis ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    const otherToken = await loginAs(app, other.username);

    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(otherToken))
      .send({ authorId: author.id, content: 'Wrong author' })
      .expect(400);
  });

  it('GET /users/:userId/mentions paginated', async () => {
    const mentioned = await createDeveloper(app, adminToken, `${suffix}_pag`);
    const author = await createDeveloper(app, adminToken, `${suffix}_pau`);
    const project = await createProject(app, adminToken, 1, `Pag ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    const authorToken = await loginAs(app, author.username);

    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(authorToken))
      .send({ authorId: author.id, content: `@${mentioned.username} hi` });

    const res = await request(app.getHttpServer())
      .get(`/users/${mentioned.id}/mentions?page=1&pageSize=10`)
      .set(authHeader(adminToken))
      .expect(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.page).toBe(1);
  });

  it('PATCH comment re-evaluates mentions', async () => {
    const u1 = await createDeveloper(app, adminToken, `${suffix}_u1`);
    const u2 = await createDeveloper(app, adminToken, `${suffix}_u2`);
    const author = await createDeveloper(app, adminToken, `${suffix}_pa`);
    const project = await createProject(app, adminToken, 1, `Patch ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    const authorToken = await loginAs(app, author.username);

    const created = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(authorToken))
      .send({ authorId: author.id, content: `@${u1.username}` })
      .expect(200);

    const patched = await request(app.getHttpServer())
      .patch(`/tickets/${ticket.id}/comments/${created.body.id}`)
      .set(authHeader(authorToken))
      .send({ content: `@${u2.username}` })
      .expect(200);
    expect(patched.body.mentionedUsers[0].username).toBe(u2.username);
  });

  it('comment on soft-deleted ticket → 404', async () => {
    const author = await createDeveloper(app, adminToken, `${suffix}_delc`);
    const project = await createProject(app, adminToken, 1, `DelC ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    const authorToken = await loginAs(app, author.username);
    await request(app.getHttpServer())
      .delete(`/tickets/${ticket.id}`)
      .set(authHeader(adminToken));
    await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(authorToken))
      .send({ authorId: author.id, content: 'Too late' })
      .expect(404);
  });

  it('DELETE comment', async () => {
    const author = await createDeveloper(app, adminToken, `${suffix}_rm`);
    const project = await createProject(app, adminToken, 1, `Rm ${suffix}`);
    const ticket = await createTicket(app, adminToken, project.id);
    const authorToken = await loginAs(app, author.username);
    const created = await request(app.getHttpServer())
      .post(`/tickets/${ticket.id}/comments`)
      .set(authHeader(authorToken))
      .send({ authorId: author.id, content: 'Delete me' })
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/tickets/${ticket.id}/comments/${created.body.id}`)
      .set(authHeader(authorToken))
      .expect(200);
  });
});
