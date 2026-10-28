'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isAuthUser, useAuthStore } from '@/stores/use-auth-store';
import { apiClient, ApiError } from '@/lib/api/client';

export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore(s => s.login);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await apiClient.post<{ accessToken?: unknown; user?: unknown }>(
        '/auth/login',
        {
          email,
          password,
        }
      );
      if (typeof response.accessToken !== 'string' || !isAuthUser(response.user)) {
        setError(
          'La respuesta del servidor no incluye los permisos y sucursales necesarios. Actualiza o reinicia el backend e inténtalo de nuevo.'
        );
        return;
      }
      login(response.accessToken, response.user);
      const next = searchParams.get('next') ?? '/dashboard';
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 401 ? t('invalidCredentials') : err.message);
      } else {
        setError('Network error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-sm border-border/60 shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">{t('login')}</CardTitle>
        <CardDescription>ERP</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">{t('password')}</Label>
              <Link
                href="/forgot-password"
                className="text-xs text-muted-foreground hover:underline"
              >
                {t('forgot')}
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="animate-spin" />}
            {t('submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
