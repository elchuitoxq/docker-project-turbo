import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

/**
 * Entrega del enlace de recuperación de contraseña.
 *
 * - Con `SMTP_URL` configurada: envía un correo real vía SMTP (nodemailer).
 * - Sin `SMTP_URL` en desarrollo: escribe el enlace en el log y lo devuelve al
 *   llamador para que la API pueda exponerlo solo fuera de producción.
 * - Sin `SMTP_URL` en producción: registra un error y no entrega nada.
 *
 * En ningún caso se registra el token en producción.
 */
@Injectable()
export class PasswordResetNotifier {
  private readonly logger = new Logger(PasswordResetNotifier.name);
  private transporter?: Transporter;

  constructor(private readonly config: ConfigService) {}

  async send(email: string, token: string): Promise<string | undefined> {
    const baseUrl =
      this.config.get<string>('PASSWORD_RESET_URL') ?? 'http://localhost:3000/reset-password';
    const link = `${baseUrl}?token=${encodeURIComponent(token)}`;
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    const smtpUrl = this.config.get<string>('SMTP_URL');

    if (!smtpUrl) {
      if (isProduction) {
        this.logger.error(
          'Se solicitó un reset de contraseña pero no hay proveedor de correo configurado (SMTP_URL)'
        );
        return undefined;
      }

      this.logger.debug(`Enlace de recuperación para ${email}: ${link}`);
      return link;
    }

    const from = this.config.get<string>('MAIL_FROM') ?? 'ERP <no-reply@erp-ve.com>';

    await this.getTransporter(smtpUrl).sendMail({
      from,
      to: email,
      subject: 'Recuperación de contraseña — ERP',
      text: [
        'Recibimos una solicitud para restablecer tu contraseña.',
        '',
        `Abre este enlace para elegir una nueva (válido por 60 minutos):`,
        link,
        '',
        'Si no solicitaste este cambio, ignora este correo.',
      ].join('\n'),
      html: [
        '<p>Recibimos una solicitud para restablecer tu contraseña.</p>',
        '<p>El enlace es válido por <strong>60 minutos</strong> y solo puede usarse una vez:</p>',
        `<p><a href="${link}">Restablecer contraseña</a></p>`,
        '<p>Si no solicitaste este cambio, ignora este correo.</p>',
      ].join('\n'),
    });

    this.logger.log(`Correo de recuperación enviado a ${email}`);

    // En producción el enlace nunca se devuelve por la API.
    return isProduction ? undefined : link;
  }

  private getTransporter(smtpUrl: string): Transporter {
    if (!this.transporter) {
      this.transporter = createTransport(smtpUrl);
    }
    return this.transporter;
  }
}
