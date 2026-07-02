import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { LoggingInterceptor } from './common/logging.interceptor';
import { TransformInterceptor } from './common/transform.interceptor';
import { TimeoutInterceptor } from './common/timeout.interceptor';
import { LegacyApiMiddleware } from './common/legacy-api.middleware';
import { json, urlencoded } from 'express';
import cookieParser from 'cookie-parser';
import { RedisIoAdapter } from './realtime/redis-io.adapter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // API Versioning
  app.setGlobalPrefix('api/v1');

  // Security Hardening
  app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    xssFilter: true,
    noSniff: true,
  }));

  // Increase payload limits for Base64 image uploads
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Legacy API compatibility middleware for old unprefixed clients.
  // This keeps production compatibility while the app continues to use /api/v1.
  const legacyApiMiddleware = new LegacyApiMiddleware();
  app.use(legacyApiMiddleware.use.bind(legacyApiMiddleware));

  // Cookie Parser for HttpOnly Auth Cookies
  app.use(cookieParser());

  // Enterprise Input Validation Strategy
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Allow primitive type conversion (e.g. "123" -> number)
      transformOptions: { enableImplicitConversion: true } as any,
    }),
  );

  // Global Exception Filter to sanitize errors
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global Interceptor for API Response Standardization
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global Interceptor for logging request/response times
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global Interceptor for request timeouts
  app.useGlobalInterceptors(new TimeoutInterceptor());

  // Robust Enterprise Dynamic CORS Configuration
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        'http://localhost:5173', // Client Showroom
        'http://localhost:5174', // Admin God Mode
        'http://localhost:5175', // Staff Inspection PWA
        'http://localhost:5176', // Admin (overflow port)
        'http://localhost:5177', // overflow
        'http://localhost', // Capacitor Android (http scheme)
        'https://localhost', // Capacitor Android (https scheme)
        'capacitor://localhost', // Capacitor iOS
        'ionic://localhost', // Ionic/Capacitor alternate
        'https://peace-cars-website.vercel.app',
        'https://peacecars.vercel.app',
        'https://staff-cyan.vercel.app',
        'https://miniapp.peacecars.com',
        'https://75d50176ace56214-196-190-62-200.serveousercontent.com',
      ];

      const isAllowed =
        allowedOrigins.includes(origin) ||
        /^https:\/\/.*\.vercel\.app$/.test(origin) || // Allow any Vercel deployment
        /^http:\/\/(127\.0\.0\.1|localhost|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin) || // Allow all local network IPs for development
        (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.split(',').includes(origin));

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type,Authorization',
    exposedHeaders: 'Authorization',
    credentials: true,
  });

  // Swagger OpenAPI Documentation Configuration
  const config = new DocumentBuilder()
    .setTitle('PeaceCars Enterprise API')
    .setDescription(
      'Official OpenAPI documentation for the PeaceCars ERP backend.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Distributed Realtime Gateway
  if (process.env.REDIS_URL) {
    const redisIoAdapter = new RedisIoAdapter(app);
    await redisIoAdapter.connectToRedis(process.env.REDIS_URL);
    app.useWebSocketAdapter(redisIoAdapter);
    console.log('[Backend] Redis WebSockets Adapter enabled.');
  } else {
    console.log('[Backend] REDIS_URL missing — falling back to standard in-memory WebSockets.');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`[Backend] Server running on http://0.0.0.0:${port}`);
}

bootstrap();
