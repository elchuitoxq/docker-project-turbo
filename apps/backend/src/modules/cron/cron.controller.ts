import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { CronService } from './cron.service';

@ApiTags('cron')
@Controller('v1/cron')
export class CronController {
  constructor(private readonly cronService: CronService) {}

  @Get('trigger-bcv')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Trigger BCV rate fetch',
    description: 'Manually triggers the BCV exchange rate scraping and stores it in the database',
  })
  @ApiResponse({
    status: 200,
    description: 'BCV rate fetch completed',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        rate: { type: 'number', example: 36.12 },
        message: { type: 'string', example: 'BCV rate fetched and stored successfully: 36.12' },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Failed to fetch BCV rate',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: false },
        message: {
          type: 'string',
          example: 'Failed to fetch BCV rate: Could not parse USD rate from BCV page',
        },
      },
    },
  })
  async triggerBcv(): Promise<{ success: boolean; rate?: number; message: string }> {
    return this.cronService.triggerBcvRateFetch();
  }
}
