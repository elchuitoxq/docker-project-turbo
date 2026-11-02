import { CheckCircle2, MinusCircle, EyeOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AccessLevel } from '@/lib/guides/types';

export const ACCESS_LABEL: Record<AccessLevel, string> = {
  full: 'Acceso completo',
  partial: 'Acceso parcial',
  none: 'Sin acceso',
};

export const ACCESS_HINT: Record<AccessLevel, string> = {
  full: 'Puedes abrir la pantalla y ejecutar todas las acciones del flujo.',
  partial: 'Puedes abrir la pantalla, pero algunas acciones del flujo te están bloqueadas.',
  none: 'No puedes abrir la pantalla con tus permisos actuales.',
};

export const ACCESS_DOT: Record<AccessLevel, string> = {
  full: 'bg-emerald-500',
  partial: 'bg-amber-500',
  none: 'bg-muted-foreground/40',
};

const ACCESS_ICON = {
  full: CheckCircle2,
  partial: MinusCircle,
  none: EyeOff,
} as const;

const ACCESS_VARIANT = {
  full: 'default',
  partial: 'secondary',
  none: 'outline',
} as const;

export function AccessBadge({ level, className }: { level: AccessLevel; className?: string }) {
  const Icon = ACCESS_ICON[level];
  return (
    <Badge
      variant={ACCESS_VARIANT[level]}
      className={cn('gap-1 font-medium', level === 'none' && 'text-muted-foreground', className)}
    >
      <Icon className="size-3.5" aria-hidden />
      {ACCESS_LABEL[level]}
    </Badge>
  );
}

export function AccessDot({ level, className }: { level: AccessLevel; className?: string }) {
  return (
    <span
      className={cn('inline-block size-2 shrink-0 rounded-full', ACCESS_DOT[level], className)}
      aria-hidden
    />
  );
}

export function AccessLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {(['full', 'partial', 'none'] as const).map(level => (
        <li key={level} className="flex items-center gap-1.5">
          <AccessDot level={level} />
          <span>{ACCESS_LABEL[level]}</span>
        </li>
      ))}
    </ul>
  );
}
