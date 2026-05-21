import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/http-exception.filter';
import { LoggingInterceptor } from './common/logging.interceptor';
import { TransformInterceptor } from './common/transform.interceptor';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Security
  app.use(helmet());

  // Increase payload limits for Base64 image uploads
  app.use(json({ limit: '50mb' }));
  app.use(urlencoded({ extended: true, limit: '50mb' }));

  // Enterprise Input Validation Strategy
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // Allow primitive type conversion (e.g. "123" -> number)
    transformOptions: { enableImplicitConversion: true } as any,
  }));

  // Global Exception Filter to sanitize errors
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Global Interceptor for API Response Standardization
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global Interceptor for logging request/response times
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Robust Enterprise Dynamic CORS Configuration
  app.enableCors({
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      if (!origin) return callback(null, true);
      
      const allowedOrigins = [
        'http://localhost:5173', // Client Showroom
        'http://localhost:5174', // Admin God Mode
        'http://localhost:5175', // Staff Inspection PWA
        'http://localhost',      // Capacitor Android/iOS
        'capacitor://localhost', // Capacitor iOS
      ];

      const isAllowed = allowedOrigins.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.endsWith('.onrender.com') ||
        (process.env.ALLOWED_ORIGINS && process.env.ALLOWED_ORIGINS.split(',').includes(origin) ? true : false);

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Swagger OpenAPI Documentation Configuration
  const config = new DocumentBuilder()
    .setTitle('PeaceCars Enterprise API')
    .setDescription('Official OpenAPI documentation for the PeaceCars ERP backend.')
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

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`[Backend] Server running on http://0.0.0.0:${port}`);
}

bootstrap();
