import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { buildOpenApiConfig } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // En desarrollo se desactiva CSP para que Swagger UI pueda cargar sus assets.
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    })
  );

  const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  app.enableCors({ origin: allowedOrigins, credentials: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  const swaggerEnabled =
    process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true';

  if (swaggerEnabled) {
    const config = buildOpenApiConfig();
    const document = SwaggerModule.createDocument(app, config);

    app.getHttpAdapter().get('/docs-json', (_req: unknown, res: { json: (d: unknown) => void }) => {
      res.json(document);
    });

    SwaggerModule.setup('docs', app, document, {
      customSiteTitle: 'ERP Venezuela API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showRequestDuration: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
    });
  }

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');

  const logger = app.get(Logger);
  logger.log(`Application running on http://localhost:${port}`);
  if (swaggerEnabled) {
    logger.log(`Swagger UI:   http://localhost:${port}/docs`);
    logger.log(`OpenAPI JSON: http://localhost:${port}/docs-json`);
  }
}

bootstrap();
