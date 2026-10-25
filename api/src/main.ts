import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createRussianValidationException } from './common/validation/russian-validation.exception';

const DEFAULT_PORT = 4000;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.useWebSocketAdapter(new IoAdapter(app));
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: createRussianValidationException,
    }),
  );
  app.enableShutdownHooks();
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API «Конструктора дегустаций»')
    .setDescription(
      'REST и real-time API для проведения дегустаций вин по 100-балльной ' +
        'шкале Роберта Паркера, синхронизации слепой дегустации и выгрузки ' +
        'оценок в «Народный винный рейтинг».',
    )
    .setVersion('0.1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT организатора дегустации',
      },
      'host-jwt',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument, {
    customSiteTitle: 'Документация API — Конструктор дегустаций',
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = Number(configService.get<string>('API_PORT') ?? DEFAULT_PORT);
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
