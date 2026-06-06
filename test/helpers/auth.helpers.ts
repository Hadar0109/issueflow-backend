import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';

export async function loginAs(
  app: INestApplication,
  username: string,
  password = 'test-password',
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ username, password })
    .expect(200);
  return res.body.accessToken as string;
}

export function authHeader(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
