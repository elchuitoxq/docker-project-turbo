import { Controller, Get, Query, Res, UseGuards, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@Controller('v1/reports/fiscal')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

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
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response
  ) {
    const content = await this.reportsService.getRetencionesIvaTxt(dateFrom, dateTo);

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
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response
  ) {
    const content = await this.reportsService.getRetencionesIslrXml(dateFrom, dateTo);

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
  async getFiscalSummary(@Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    return this.reportsService.getFiscalSummary(dateFrom, dateTo);
  }

  @Get('libro-ventas')
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
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response
  ) {
    const content = await this.reportsService.getLibroVentas(dateFrom, dateTo);

    if (res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="libro_ventas.csv"');
      return res.send(content);
    }

    return content;
  }

  @Get('libro-compras')
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
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Res() res?: Response
  ) {
    const content = await this.reportsService.getLibroCompras(dateFrom, dateTo);

    if (res) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="libro_compras.csv"');
      return res.send(content);
    }

    return content;
  }
}
