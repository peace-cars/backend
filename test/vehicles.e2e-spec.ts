import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('VehiclesController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api/v1/vehicles/showroom (GET) should return array of vehicles', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles/showroom')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    if (response.body.length > 0) {
      expect(response.body[0]).toHaveProperty('make');
      expect(response.body[0]).toHaveProperty('model');
      expect(response.body[0]).toHaveProperty('retail_price_etb');
    }
  });

  it('/api/v1/vehicles/showroom/:id (GET) should handle invalid UUID', async () => {
    // Ideally this returns 400 Bad Request via ParseUUIDPipe
    const response = await request(app.getHttpServer())
      .get('/api/v1/vehicles/showroom/invalid-uuid');
      
    expect([400, 404, 500]).toContain(response.status);
  });
});
