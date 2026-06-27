import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // Security Headers
  app.use(helmet({
    contentSecurityPolicy: false, // Turn off CSP for Swagger docs to load styling correctly in dev
  }));

  // Cookie Parser
  app.use(cookieParser());

  // CORS config with credentials support for HttpOnly cookies
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  });

  // Global prefix with health-check exclusion for Docker
  app.setGlobalPrefix('api/v1', { exclude: ['health'] });

  // Global Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('GymTracker API')
    .setDescription('REST API for the GymTracker application, including exercise logs, routines, and AI export.')
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

  const port = process.env.PORT || 3600;
  await app.listen(port);
  logger.log(`GymTracker Backend is running on: http://localhost:${port}/api/v1`);
  logger.log(`API Swagger documentation available at: http://localhost:${port}/api/docs`);
}
bootstrap();
