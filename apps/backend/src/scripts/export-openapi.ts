import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { AppModule } from '../app.module';
import { buildOpenApiConfig } from '../swagger.config';

async function exportOpenApi(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] });
  const config = buildOpenApiConfig();
  const document = SwaggerModule.createDocument(app, config);

  const outPath = resolve(process.cwd(), 'docs', 'openapi.json');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(document, null, 2), 'utf-8');

  console.log(`[openapi] Document written to ${join(outPath)}`);
  await app.close();
}

exportOpenApi().catch((err) => {
  console.error('[openapi] Failed to export document', err);
  process.exit(1);
});
