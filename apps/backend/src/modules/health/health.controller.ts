import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { sql } from 'drizzle-orm';
import { db } from '../../database';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Get()
  @Public()
  @ApiOperation({ summary: 'Health check (usado por Docker/CI)' })
  @ApiResponse({ status: 200, description: 'Servicio y base de datos disponibles' })
  @ApiResponse({ status: 503, description: 'Dependencia no disponible' })
  async check(): Promise<{ status: string; database: string; uptime: number }> {
    try {
      await db.execute(sql`select 1`);
    } catch {
      throw new ServiceUnavailableException({ status: 'error', database: 'down' });
    }

    return {
      status: 'ok',
      database: 'up',
      uptime: Math.round(process.uptime()),
    };
  }
}
