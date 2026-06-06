import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { authHeader, loginAs } from './auth.helpers';

export async function createDeveloper(
  app: INestApplication,
  adminToken: string,
  suffix: string,
) {
  const res = await request(app.getHttpServer())
    .post('/users')
    .set(authHeader(adminToken))
    .send({
      username: `dev_${suffix}`,
      email: `dev_${suffix}@example.com`,
      fullName: `Developer ${suffix}`,
      role: 'DEVELOPER',
    })
    .expect(200);
  return res.body;
}

export async function createAdminUser(
  app: INestApplication,
  adminToken: string,
  suffix: string,
) {
  const res = await request(app.getHttpServer())
    .post('/users')
    .set(authHeader(adminToken))
    .send({
      username: `adm_${suffix}`,
      email: `adm_${suffix}@example.com`,
      fullName: `Admin ${suffix}`,
      role: 'ADMIN',
    })
    .expect(200);
  return res.body;
}

export async function createProject(
  app: INestApplication,
  token: string,
  ownerId: number,
  name: string,
) {
  const res = await request(app.getHttpServer())
    .post('/projects')
    .set(authHeader(token))
    .send({ name, description: 'Test project', ownerId })
    .expect(200);
  return res.body;
}

export async function createTicket(
  app: INestApplication,
  token: string,
  projectId: number,
  overrides: Record<string, unknown> = {},
) {
  const res = await request(app.getHttpServer())
    .post('/tickets')
    .set(authHeader(token))
    .send({
      title: 'Test ticket',
      description: 'Desc',
      status: 'TODO',
      priority: 'HIGH',
      type: 'BUG',
      projectId,
      ...overrides,
    })
    .expect(200);
  return res.body;
}

export async function bootstrapAdmin(app: INestApplication) {
  return loginAs(app, 'admin', 'admin123');
}
