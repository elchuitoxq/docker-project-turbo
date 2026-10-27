import { Controller, Get, Post, Body, Query, Res, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBody } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { FiscalBookService, type BookType } from './fiscal/fiscal-book.service';
import { FiscalValidationService } from './fiscal/fiscal-validation.service';
import {
  FiscalExportService,
  type FiscalFormat,
  type FiscalReportType,
} from './fiscal/fiscal-export.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { CurrentBranch } from '../../common/decorators/current-branch.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

@ApiTags('reports')
@Controller('v1/reports/fiscal')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly books: FiscalBookService = new FiscalBookService(),
    private readonly validation: FiscalValidationService = new FiscalValidationService(),
    private readonly exports: FiscalExportService = new FiscalExportService()
  ) {}

  @Get('retenciones-txt')
  @ApiOperation({
    summary: 'Get IVA retentions TXT file',
    description: 'Generates a TXT file with IVA retentions in SENIAT format',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Start date for the report (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'End date for the report (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'TXT file with IVA retentions',
    content: {
      'text/plain': {
        schema: {
          type: 'string',
          example: 'J-12345678|01/01/2024|RC-00001|1000.00|160.00|2024-01|',
        },
      },
    },
  })
  async getRetencionesIvaTxt(
    @CurrentBranch() branchId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response
  ) {
    const content = await this.reportsService.getRetencionesIvaTxt(dateFrom, dateTo, branchId);

    if (res) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="retenciones_iva.txt"');
      return res.send(content);
    }

    return content;
  }

  @Get('retenciones-xml')
  @ApiOperation({
    summary: 'Get ISLR retentions XML file',
    description: 'Generates an XML file with ISLR retentions',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Start date for the report (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'End date for the report (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'XML file with ISLR retentions',
    content: {
      'application/xml': {
        schema: {
          type: 'string',
          example:
            '<?xml version="1.0" encoding="UTF-8"?><RelacionRetencionesISLR>...</RelacionRetencionesISLR>',
        },
      },
    },
  })
  async getRetencionesIslrXml(
    @CurrentBranch() branchId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response
  ) {
    const content = await this.reportsService.getRetencionesIslrXml(dateFrom, dateTo, branchId);

    if (res) {
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="retenciones_islr.xml"');
      return res.send(content);
    }

    return content;
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Get fiscal summary',
    description: 'Returns a summary of all fiscal documents within the date range',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Start date for the report (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'End date for the report (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Fiscal summary',
    schema: {
      example: {
        totalInvoices: 100,
        totalCreditNotes: 5,
        totalRetencionesIva: 15000.0,
        totalRetencionesIslr: 8000.0,
        totalBaseImponible: 500000.0,
        totalIva: 80000.0,
        totalIgtf: 15000.0,
        totalCreditNotesAmount: 25000.0,
        dateFrom: '2024-01-01',
        dateTo: '2024-01-31',
      },
    },
  })
  async getFiscalSummary(
    @CurrentBranch() branchId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string
  ) {
    return this.reportsService.getFiscalSummary(dateFrom, dateTo, branchId);
  }

  @Get('libro-ventas/csv')
  @ApiOperation({
    summary: 'Get Sales Book (Libro de Ventas) CSV',
    description: 'Generates a CSV file with the Sales Book data',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Start date for the report (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'End date for the report (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file with Sales Book',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          example:
            'Fecha|N° Factura|N° Control|RifCliente|Nompre|Total|Exento|Base Imponible|IVA|...',
        },
      },
    },
  })
  async getLibroVentas(
    @CurrentBranch() branchId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response
  ) {
    const content = await this.reportsService.getLibroVentas(dateFrom, dateTo, branchId);

    if (res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="libro_ventas.csv"');
      return res.send(content);
    }

    return content;
  }

  @Get('libro-compras/csv')
  @ApiOperation({
    summary: 'Get Purchases Book (Libro de Compras) CSV',
    description: 'Generates a CSV file with the Purchases Book data',
  })
  @ApiQuery({
    name: 'dateFrom',
    required: false,
    description: 'Start date for the report (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'dateTo',
    required: false,
    description: 'End date for the report (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'CSV file with Purchases Book',
    content: {
      'text/csv': {
        schema: {
          type: 'string',
          example:
            'Fecha|N° Factura|N° Control|RifProveedor|Nompre|Total|Exento|Base Imponible|IVA|...',
        },
      },
    },
  })
  async getLibroCompras(
    @CurrentBranch() branchId: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response
  ) {
    const content = await this.reportsService.getLibroCompras(dateFrom, dateTo, branchId);

    if (res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="libro_compras.csv"');
      return res.send(content);
    }

    return content;
  }

  // ── Libros con totales por alícuota (T-06-02) ───────────────────────────────────────────────

  @Get('libro-ventas')
  @RequirePermissions('finance:retentions:view')
  @ApiOperation({
    summary: 'Libro de ventas con totales por alícuota',
    description:
      'Asientos de la sucursal en moneda funcional; las notas de crédito restan. Sólo documentos POSTED',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-10-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-10-31' })
  @ApiResponse({ status: 200, description: 'Libro de ventas' })
  async getLibroVentasJson(
    @CurrentBranch() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.book(branchId, 'SALES', from, to);
  }

  @Get('libro-compras')
  @RequirePermissions('finance:retentions:view')
  @ApiOperation({ summary: 'Libro de compras con totales por alícuota' })
  @ApiQuery({ name: 'from', required: false, example: '2026-10-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-10-31' })
  @ApiResponse({ status: 200, description: 'Libro de compras' })
  async getLibroComprasJson(
    @CurrentBranch() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.book(branchId, 'PURCHASES', from, to);
  }

  @Get('validation')
  @RequirePermissions('finance:retentions:view')
  @ApiOperation({
    summary: 'Validaciones previas a exportar (T-06-04)',
    description:
      'RIF, número de control, huecos de secuencia y cierres. `canExport` es false si hay errores',
  })
  @ApiQuery({ name: 'from', required: false, example: '2026-10-01' })
  @ApiQuery({ name: 'to', required: false, example: '2026-10-31' })
  @ApiResponse({ status: 200, description: 'Hallazgos fiscales' })
  async getValidation(
    @CurrentBranch() branchId: string,
    @Query('from') from?: string,
    @Query('to') to?: string
  ) {
    return this.validation.validate(branchId, from, to);
  }

  @Post('exports')
  @RequirePermissions('finance:reports:view')
  @ApiOperation({
    summary: 'Exportar un reporte fiscal (T-06-05)',
    description:
      'Genera el archivo, lo registra con hash y correlativo, y devuelve el contenido. `409` si la validación tiene errores',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['reportType', 'format'],
      properties: {
        reportType: {
          type: 'string',
          enum: ['LIBRO_VENTAS', 'LIBRO_COMPRAS', 'RETENCIONES_IVA', 'RETENCIONES_ISLR'],
        },
        format: { type: 'string', enum: ['CSV', 'TXT', 'XML'] },
        from: { type: 'string', example: '2026-10-01' },
        to: { type: 'string', example: '2026-10-31' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Archivo generado y registrado' })
  @ApiResponse({ status: 409, description: 'La validación tiene errores' })
  async createExport(
    @CurrentBranch() branchId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      reportType: FiscalReportType;
      format: FiscalFormat;
      from?: string;
      to?: string;
    }
  ) {
    return this.exportReport(branchId, userId, body);
  }

  private async book(branchId: string, type: BookType, from?: string, to?: string) {
    return this.books.build(branchId, type, from, to);
  }

  private async exportReport(
    branchId: string,
    userId: string | undefined,
    body: { reportType: FiscalReportType; format: FiscalFormat; from?: string; to?: string }
  ) {
    const content =
      body.reportType === 'RETENCIONES_IVA'
        ? await this.reportsService.getRetencionesIvaTxt(body.from, body.to, branchId)
        : body.reportType === 'RETENCIONES_ISLR'
          ? await this.reportsService.getRetencionesIslrXml(body.from, body.to, branchId)
          : undefined;

    return this.exports.export({
      branchId,
      reportType: body.reportType,
      format: body.format,
      from: body.from,
      to: body.to,
      userId,
      content,
    });
  }
}
