import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { AppLogger } from './common/logging/app.logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new AppLogger(),
  });

  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Knowledge Hub API')
    .setDescription('REST API for the Knowledge Hub platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('doc', app, document);

  const configService = app.get(ConfigService);
  const port = Number.parseInt(String(configService.get('PORT') ?? 4000), 10);

  await app.listen(port);

  const processLogger = new Logger('Process');
  let isShuttingDown = false;
  const gracefulExit = async (
    source: 'uncaughtException' | 'unhandledRejection',
    reason: unknown,
  ) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    const err = reason instanceof Error ? reason : new Error(String(reason));
    processLogger.error(`${source}: ${err.message}`, err.stack);
    try {
      await app.close();
    } catch (closeErr) {
      processLogger.error(
        'Error while closing the application',
        closeErr instanceof Error ? closeErr.stack : String(closeErr),
      );
    }
    process.exit(1);
  };

  process.on('uncaughtException', (error: Error) => {
    void gracefulExit('uncaughtException', error);
  });
  process.on('unhandledRejection', (reason: unknown) => {
    void gracefulExit('unhandledRejection', reason);
  });
}

bootstrap();
