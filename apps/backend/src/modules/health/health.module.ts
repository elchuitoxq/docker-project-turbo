import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { RateHealthController } from './rate-health.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
  // `GET /v1/health/rates` informa el estado de la tasa con el mismo servicio que la emite.
  imports: [SettingsModule],
  controllers: [HealthController, RateHealthController],
})
export class HealthModule {}
