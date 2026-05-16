import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enterprise Input Validation Strategy
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Strict Enterprise CORS Configuration for all Active Platforms
  app.enableCors({
    origin: [
      'http://localhost:5173', // Client Showroom
      'http://localhost:5174', // Admin God Mode
      'http://localhost:5175', // Staff Inspection PWA
      'http://localhost',      // Capacitor Android/iOS
      'capacitor://localhost', // Capacitor iOS
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`[Backend] Server running on http://0.0.0.0:${port}`);
}

bootstrap();
