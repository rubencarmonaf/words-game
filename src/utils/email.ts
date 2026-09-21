/**
 * Envío de emails (verificación de cuenta y recuperar contraseña).
 *
 * Se usa la API HTTP de Resend (https://resend.com) en lugar de SMTP: el plan
 * gratuito de Render bloquea el SMTP saliente.
 *
 *   RESEND_API_KEY  clave de la API de Resend
 *   EMAIL_FROM      remitente, p. ej. `WordWars <no-reply@tu-dominio.com>`. El
 *                   dominio tiene que estar verificado en Resend; sin dominio
 *                   propio solo vale `onboarding@resend.dev`, que únicamente
 *                   entrega a la dirección con la que te registraste en Resend.
 *
 * Sin RESEND_API_KEY no se envía nada: el contenido (y el enlace) se imprime por
 * consola, suficiente para desarrollar y probar los flujos.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const RESEND_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'WordWars <onboarding@resend.dev>';

export const isEmailConfigured = (): boolean => Boolean(process.env.RESEND_API_KEY);

/** Avisa al arrancar de configuraciones que harían que los correos no lleguen. */
export function warnAboutEmailConfig(): void {
  if (!isEmailConfigured()) return;
  const from = process.env.EMAIL_FROM || DEFAULT_FROM;
  if (from.includes('@resend.dev')) {
    console.warn(
      '⚠️  EMAIL_FROM usa resend.dev: Resend solo entregará a la dirección de tu cuenta. ' +
        'Verifica un dominio propio en Resend y ponlo en EMAIL_FROM para escribir a cualquier usuario.'
    );
  }
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('\n📧 ───────────── EMAIL (modo dev, no enviado) ─────────────');
    console.log(`   Para:    ${message.to}`);
    console.log(`   Asunto:  ${message.subject}`);
    console.log('   ----------------------------------------------------------');
    console.log(message.text.split('\n').map((l) => '   ' + l).join('\n'));
    console.log('   ──────────────────────────────────────────────────────────\n');
    return;
  }

  const response = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      html: message.html
    }),
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Resend respondió ${response.status}: ${detail.slice(0, 300)}`);
  }
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function actionEmailHtml(title: string, intro: string, buttonLabel: string, url: string, footnote: string): string {
  const safeUrl = escapeHtml(url);
  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
      <p style="color:#555;line-height:1.6">${intro}</p>
      <p style="margin:28px 0">
        <a href="${safeUrl}" style="background:#f5a623;color:#0a1628;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;display:inline-block">${escapeHtml(buttonLabel)}</a>
      </p>
      <p style="color:#888;font-size:13px;line-height:1.6">${escapeHtml(footnote)}</p>
      <p style="color:#aaa;font-size:12px;word-break:break-all">${safeUrl}</p>
    </div>`;
}

/** Correo con el enlace para confirmar que la dirección es de quien se registró. */
export async function sendVerificationEmail(to: string, username: string, verifyUrl: string): Promise<void> {
  const subject = 'Confirma tu email en WordWars';
  const text =
    `Hola ${username}, gracias por unirte a WordWars.\n\n` +
    `Confirma tu email abriendo este enlace (caduca en 24 horas):\n` +
    `${verifyUrl}\n\n` +
    `Si no creaste esta cuenta, ignora este correo y se borrará sola.`;
  const html = actionEmailHtml(
    'Confirma tu email',
    `Hola <strong>${escapeHtml(username)}</strong>, gracias por unirte a <strong>WordWars</strong>. Pulsa el botón para activar tu cuenta. El enlace caduca en 24 horas.`,
    'Confirmar email',
    verifyUrl,
    'Si no creaste esta cuenta, ignora este correo y se borrará sola.'
  );
  await sendEmail({ to, subject, text, html });
}

/** Correo de reseteo de contraseña. */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = 'Restablece tu contraseña de WordWars';
  const text =
    `Has solicitado restablecer tu contraseña de WordWars.\n\n` +
    `Abre este enlace para crear una nueva contraseña (caduca en 1 hora):\n` +
    `${resetUrl}\n\n` +
    `Si no fuiste tú, ignora este correo: tu contraseña no cambiará.`;
  const html = actionEmailHtml(
    'Restablece tu contraseña',
    'Has solicitado restablecer tu contraseña de <strong>WordWars</strong>. Pulsa el botón para crear una nueva. El enlace caduca en 1 hora.',
    'Crear nueva contraseña',
    resetUrl,
    'Si no fuiste tú, ignora este correo: tu contraseña no cambiará.'
  );
  await sendEmail({ to, subject, text, html });
}
