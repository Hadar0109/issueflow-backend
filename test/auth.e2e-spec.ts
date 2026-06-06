import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { authHeader, loginAs } from './helpers/auth.helpers';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/login returns token for seeded admin', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'admin', password: 'any-password' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.tokenType).toBe('Bearer');
    expect(res.body.expiresIn).toBe(3600);
  });

  it('POST /auth/login returns 401 for unknown username', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'nobody', password: 'x' })
      .expect(401);
  });

  it('POST /auth/login returns 401 for empty fields', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: '', password: '' })
      .expect(401);
  });

  it('GET /auth/me returns profile with valid JWT', async () => {
    const token = await loginAs(app, 'admin');
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(token))
      .expect(200);
    expect(res.body.username).toBe('admin');
    expect(res.body.role).toBe('ADMIN');
  });

  it('protected route returns 401 without token', () => {
    return request(app.getHttpServer()).get('/users').expect(401);
  });

  it('POST /auth/logout invalidates token', async () => {
    const token = await loginAs(app, 'admin');
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set(authHeader(token))
      .expect(200);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set(authHeader(token))
      .expect(401);
  });
});
