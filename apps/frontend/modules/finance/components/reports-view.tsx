'use client';

import * as React from 'react';
import { BarChart3, Download, FileText, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { reportsApi } from '../api/reports';
import { formatCurrency } from '@/lib/utils';

export function ReportsView() {
  const [from, setFrom] = React.useState('2026-01-01');
  const [to, setTo] = React.useState('2026-12-31');
  const [busy, setBusy] = React.useState<string | null>(null);

  async function downloadJson(kind: 'balance' | 'income' | 'iva' | 'islr') {
    setBusy(kind);
    try {
      let data: unknown;
      let filename = '';
      if (kind === 'balance') {
        data = await reportsApi.balanceSheet(to);
        filename = `balance-${to}.json`;
      } else if (kind === 'income') {
        data = await reportsApi.incomeStatement(from, to);
        filename = `income-${from}-to-${to}.json`;
      } else if (kind === 'iva') {
        data = await reportsApi.ivaBook(from, to, 'SALES');
        filename = `iva-sales-${from}-to-${to}.json`;
      } else {
        data = await reportsApi.islrBook(from, to);
        filename = `islr-${from}-to-${to}.json`;
      }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Error al generar el reporte');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reportes financieros</h1>
        <p className="text-sm text-muted-foreground">
          Balance, estado de resultados, libros IVA/ISLR
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <p className="mb-1 text-xs text-muted-foreground">Desde</p>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="flex-1">
            <p className="mb-1 text-xs text-muted-foreground">Hasta</p>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <ReportCard
          title="Balance general"
          description="Activos, pasivos y patrimonio al cierre del período"
          icon={BarChart3}
          onClick={() => downloadJson('balance')}
          loading={busy === 'balance'}
          tag="Contable"
        />
        <ReportCard
          title="Estado de resultados"
          description="Ingresos, costos y gastos del período"
          icon={FileText}
          onClick={() => downloadJson('income')}
          loading={busy === 'income'}
          tag="Contable"
        />
        <ReportCard
          title="Libro de ventas IVA"
          description="Ventas gravadas y débito fiscal"
          icon={FileSpreadsheet}
          onClick={() => downloadJson('iva')}
          loading={busy === 'iva'}
          tag="SENIAT"
        />
        <ReportCard
          title="Libro ISLR"
          description="Retenciones ISLR del período"
          icon={FileSpreadsheet}
          onClick={() => downloadJson('islr')}
          loading={busy === 'islr'}
          tag="SENIAT"
        />
      </div>
    </div>
  );
}

function ReportCard({
  title,
  description,
  icon: Icon,
  onClick,
  loading,
  tag,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  loading: boolean;
  tag: string;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Icon className="size-5 text-muted-foreground" />
          <Badge variant="outline">{tag}</Badge>
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        <Button variant="outline" className="w-full" onClick={onClick} disabled={loading}>
          <Download /> {loading ? 'Generando…' : 'Descargar'}
        </Button>
      </CardContent>
    </Card>
  );
}
