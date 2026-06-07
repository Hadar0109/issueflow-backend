import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createE2eApp, uniqueSuffix } from './helpers/e2e-app';
import { authHeader, loginAs } from './helpers/auth.helpers';
import { bootstrapAdmin, createDeveloper } from './helpers/fixtures';

describe('Password enrollment (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  const suffix = uniqueSuffix();
  const enrolledPassword = `enroll_${suffix}`;

  beforeAll(async () => {
    app = await createE2eApp();
    adminToken = await bootstrapAdmin(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('seeded admin verifies predefined password and rejects wrong password', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'wrong-password' })
      .expect(401);
  });

  it('first login enrolls password for API-created user; later login verifies it', async () => {
    const dev = await createDeveloper(app, adminToken, `${suffix}_enroll`);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: dev.username, password: enrolledPassword })
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: dev.username, password: 'wrong-password' })
      .expect(401);

    const token = await loginAs(app, dev.username, enrolledPassword);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(token))
      .expect(200);
  });
});
