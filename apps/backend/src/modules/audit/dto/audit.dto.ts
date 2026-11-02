import { ApiProperty } from '@nestjs/swagger';

export class AuditLogResponseDto {
  @ApiProperty({ example: '3f1c2b7e-7a4d-4f0e-9a51-2c8d6e1b0f3a' })
  id: string;

  @ApiProperty({ example: 'invoices' })
  entityTable: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  entityId: string | null;

  @ApiProperty({ example: 'POST' })
  action: string;

  @ApiProperty({ example: 'Publicó', nullable: true })
  actionLabel: string | null;

  @ApiProperty({ example: 'factura', nullable: true })
  entityLabel: string | null;

  @ApiProperty({ example: 'billing', nullable: true })
  module: string | null;

  @ApiProperty({
    description: 'Cambios aplicados: `{ before, after, changedFields }`',
    nullable: true,
  })
  changes: unknown;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  branchId: string | null;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  userId: string | null;

  @ApiProperty({ example: 'Ana Pérez', nullable: true })
  actorName: string | null;

  @ApiProperty({ example: 'ana@empresa.com', nullable: true })
  actorEmail: string | null;

  @ApiProperty({ example: ['ADMIN'], nullable: true, type: [String] })
  actorRoles: string[] | null;

  @ApiProperty({ example: '127.0.0.1', nullable: true })
  ipAddress: string | null;

  @ApiProperty({ example: 'Mozilla/5.0', nullable: true })
  userAgent: string | null;

  @ApiProperty({ example: 'POST', nullable: true })
  httpMethod: string | null;

  @ApiProperty({ example: '/v1/billing/invoices/…​/post', nullable: true })
  route: string | null;

  @ApiProperty({ enum: ['SUCCESS', 'DENIED', 'ERROR'], example: 'SUCCESS', nullable: true })
  result: string | null;

  @ApiProperty({ example: 42, nullable: true })
  durationMs: number | null;

  @ApiProperty({ example: 'FAC-000123', nullable: true })
  documentCode: string | null;

  @ApiProperty({ example: 'POSTED', nullable: true })
  documentStatus: string | null;

  @ApiProperty({ example: 'Publicó la factura FAC-000123', nullable: true })
  description: string | null;

  @ApiProperty({ example: '2026-10-31T14:30:00.000Z', nullable: true })
  createdAt: Date | null;
}

export class AuditLogPageDto {
  @ApiProperty({ type: [AuditLogResponseDto] })
  data: AuditLogResponseDto[];

  @ApiProperty({ example: 137 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 50 })
  limit: number;
}

export class AuditFacetDto {
  @ApiProperty({ example: 'billing' })
  value: string;

  @ApiProperty({ example: 'Facturación' })
  label: string;

  @ApiProperty({ example: 37 })
  count: number;
}

export class AuditActorFacetDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', nullable: true })
  userId: string | null;

  @ApiProperty({ example: 'Ana Pérez' })
  name: string;

  @ApiProperty({ example: 12 })
  count: number;
}

export class AuditFacetsDto {
  @ApiProperty({ type: [AuditActorFacetDto] })
  actors: AuditActorFacetDto[];

  @ApiProperty({ type: [AuditFacetDto] })
  modules: AuditFacetDto[];

  @ApiProperty({ type: [AuditFacetDto] })
  actions: AuditFacetDto[];

  @ApiProperty({ type: [AuditFacetDto] })
  tables: AuditFacetDto[];

  @ApiProperty({ type: [AuditFacetDto] })
  results: AuditFacetDto[];
}
