import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('FinanceController (e2e)', () => {
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

  it('/api/v1/finance/rate (GET) should return exchange rate', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/finance/rate')
      .expect(200);
      
    expect(response.body).toHaveProperty('currency', 'USD');
    expect(response.body).toHaveProperty('rate_etb');
  });

  it('/api/v1/finance/calculator (POST) should calculate delta', async () => {
    const payload = { targetCarPriceEtb: 5000000, tradeInValueEtb: 2000000, isEV: true };
    const response = await request(app.getHttpServer())
      .post('/api/v1/finance/calculator')
      .send(payload)
      .expect(201);
      
    expect(response.body).toHaveProperty('deltaBalance');
  });
});
