'use client';

import { NextIntlClientProvider } from 'next-intl';
import { useUiStore } from '@/stores/use-ui-store';
import esVE from './locales/es-VE.json';
import enUS from './locales/en-US.json';

const messages = {
  'es-VE': esVE,
  'en-US': enUS,
} as const;

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const language = useUiStore(s => s.language);
  return (
    <NextIntlClientProvider
      locale={language}
      messages={messages[language]}
      timeZone="America/Caracas"
    >
      {children}
    </NextIntlClientProvider>
  );
}
