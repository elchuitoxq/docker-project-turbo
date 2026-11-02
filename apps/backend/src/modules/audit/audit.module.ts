import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

/**
 * `@Global` porque la escritura de auditoría es transversal: el interceptor y los guards la usan
 * desde el contexto de cualquier módulo, sin que cada uno tenga que importar `AuditModule`.
 */
@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
