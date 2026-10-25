'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldOff } from 'lucide-react';

const REASON_KEYS = {
  'no-company': 'noCompany',
  'no-branch': 'noBranch',
  'no-permission': 'noPermission',
} as const;

function ForbiddenContent() {
  const t = useTranslations('forbidden');
  const params = useSearchParams();
  const reason = (params.get('reason') as keyof typeof REASON_KEYS) ?? 'no-permission';
  const messageKey = REASON_KEYS[reason] ?? 'noPermission';

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="items-center text-center">
        <ShieldOff className="size-10 text-muted-foreground" />
        <CardTitle>403</CardTitle>
        <CardDescription>{t(messageKey)}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Button asChild>
          <Link href="/dashboard">{t('backToDashboard')}</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
      <Suspense fallback={null}>
        <ForbiddenContent />
      </Suspense>
    </div>
  );
}
