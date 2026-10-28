'use client';

import * as React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { apiClient, ApiError } from '@/lib/api/client';

type ForgotPasswordResponse = { message: string; mockUrl?: string };

/** Datos que la pantalla necesita recordar después de enviar (el correo, para el mensaje). */
type SentState = { email: string; mockUrl?: string }; /**
 * «Olvidé mi contraseña» (`P-23`).
 *
 * La API ya enviaba el enlace por correo; lo que faltaba era la puerta de entrada. La respuesta es
 * siempre la misma exista o no la cuenta (la API lo hace así para no filtrar qué correos están
 * registrados), y el enlace directo sólo se muestra en desarrollo, igual que en el backend.
 */
export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const [email, setEmail] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [sent, setSent] = React.useState<SentState | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const address = email.trim();

    try {
      const response = await apiClient.post<ForgotPasswordResponse>('/auth/forgot-password', {
        email: address,
      });
      setSent({ email: address, mockUrl: response.mockUrl });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.status === 429 ? t('tooManyAttempts') : err.message);
      } else {
        setError('Network error');
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="w-full max-w-sm border-border/60 shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">{t('sentTitle')}</CardTitle>
          <CardDescription>{t('sentDescription', { email: sent.email })}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {sent.mockUrl ? (
            <Alert data-testid="forgot-password-dev-link">
              <CheckCircle2 />
              <AlertTitle>{t('devLinkTitle')}</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>{t('devLinkDescription')}</span>
                <Link href={sent.mockUrl} className="font-medium break-all underline">
                  {sent.mockUrl}
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}

          <Button asChild variant="outline" className="w-full">
            <Link href="/login">
              <ArrowLeft data-icon="inline-start" />
              {t('backToLogin')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-sm border-border/60 shadow-lg">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="forgot-email">{t('email')}</FieldLabel>
              <Input
                id="forgot-email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="usuario@empresa.com"
                required
                value={email}
                onChange={event => setEmail(event.target.value)}
                disabled={loading}
              />
              <FieldDescription>{t('hint')}</FieldDescription>
            </Field>
          </FieldGroup>

          {error ? (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {t('submit')}
          </Button>

          <Link
            href="/login"
            className="block text-center text-sm text-muted-foreground hover:underline"
          >
            {t('backToLogin')}
          </Link>
        </form>
      </CardContent>
    </Card>
  );
}
