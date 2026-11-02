import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Un paso del histórico de un documento (`S-12`).
 *
 * Lleva el autor resuelto (`userName`) para que la ficha no tenga que cruzar usuarios, y los estados de
 * origen y destino para que la UI pueda mostrar la transición ("Borrador → Confirmado").
 */
export class DocumentEventDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440123' })
  id: string;

  @ApiProperty({ enum: ['ORDER', 'INVOICE'], example: 'ORDER' })
  documentType: 'ORDER' | 'INVOICE';

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440011',
    description: 'Documento al que pertenece el evento',
  })
  documentId: string;

  @ApiPropertyOptional({ example: 'ORD-000001' })
  documentCode: string | null;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440011',
    description: 'Pedido de origen cuando el evento pertenece a una factura',
  })
  parentDocumentId: string | null;

  @ApiProperty({
    enum: [
      'ORDER_CREATED',
      'ORDER_UPDATED',
      'ORDER_CONFIRMED',
      'ORDER_CANCELLED',
      'ORDER_INVOICED',
      'INVOICE_CREATED',
      'INVOICE_UPDATED',
      'INVOICE_POSTED',
      'INVOICE_VOIDED',
    ],
    example: 'ORDER_CONFIRMED',
  })
  action: string;

  @ApiPropertyOptional({ example: 'DRAFT' })
  fromStatus: string | null;

  @ApiPropertyOptional({ example: 'CONFIRMED' })
  toStatus: string | null;

  @ApiPropertyOptional({ example: 'Motivo: error en el precio' })
  description: string | null;

  @ApiPropertyOptional({ description: 'Datos de apoyo del evento (total, moneda, folio…)' })
  metadata: Record<string, unknown> | null;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440006' })
  userId: string | null;

  @ApiPropertyOptional({ example: 'Test Manager' })
  userName: string | null;

  @ApiPropertyOptional({ example: '2026-10-30T18:22:41.000Z' })
  createdAt: Date | null;
}
