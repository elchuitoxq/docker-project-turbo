import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PasswordResetNotifier } from './password-reset.notifier';

const sendMail = vi.fn();

vi.mock('nodemailer', () => ({
  createTransport: vi.fn(() => ({ sendMail })),
}));

function configWith(values: Record<string, string | undefined>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('PasswordResetNotifier', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendMail.mockResolvedValue({ messageId: 'x' });
  });

  it('en desarrollo sin SMTP_URL devuelve el enlace y no envía correo', async () => {
    const notifier = new PasswordResetNotifier(
      configWith({ NODE_ENV: 'development', PASSWORD_RESET_URL: 'http://app/reset' })
    );

    const link = await notifier.send('a@b.c', 'tok-123');

    expect(link).toBe('http://app/reset?token=tok-123');
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('en producción sin SMTP_URL no entrega ni expone el enlace', async () => {
    const notifier = new PasswordResetNotifier(configWith({ NODE_ENV: 'production' }));

    const link = await notifier.send('a@b.c', 'tok-123');

    expect(link).toBeUndefined();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('con SMTP_URL envía el correo con el enlace y no lo devuelve en producción', async () => {
    const notifier = new PasswordResetNotifier(
      configWith({
        NODE_ENV: 'production',
        SMTP_URL: 'smtp://user:pass@localhost:1025',
        MAIL_FROM: 'ERP <no-reply@test.local>',
        PASSWORD_RESET_URL: 'https://erp.example/reset',
      })
    );

    const link = await notifier.send('user@test.local', 'tok-abc');

    expect(link).toBeUndefined();
    expect(sendMail).toHaveBeenCalledTimes(1);

    const message = sendMail.mock.calls[0][0];
    expect(message.to).toBe('user@test.local');
    expect(message.from).toBe('ERP <no-reply@test.local>');
    expect(message.text).toContain('https://erp.example/reset?token=tok-abc');
    expect(message.html).toContain('https://erp.example/reset?token=tok-abc');
  });

  it('reutiliza el transporter entre envíos', async () => {
    const notifier = new PasswordResetNotifier(
      configWith({ NODE_ENV: 'development', SMTP_URL: 'smtp://localhost:1025' })
    );
    const { createTransport } = await import('nodemailer');

    await notifier.send('a@b.c', 't1');
    await notifier.send('a@b.c', 't2');

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(2);
  });
});
