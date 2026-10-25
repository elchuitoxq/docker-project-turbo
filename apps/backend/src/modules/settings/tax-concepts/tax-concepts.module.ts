import { Module } from '@nestjs/common';
import { TaxConceptsController } from './tax-concepts.controller';
import { TaxConceptsService } from './tax-concepts.service';

@Module({
  controllers: [TaxConceptsController],
  providers: [TaxConceptsService],
  exports: [TaxConceptsService],
})
export class TaxConceptsModule {}
