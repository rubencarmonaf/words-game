/**
 * Utilidad de envío de email.
 *
 * MODO DEV (actual): si no hay configuración SMTP en el entorno, en lugar de
 * enviar el correo se imprime el contenido (y el enlace) por consola. Suficiente
 * para desarrollar y probar el flujo de reseteo de contraseña.
 *
 * PARA ACTIVAR ENVÍO REAL (p.ej. Zoho):
 *   1) npm i nodemailer @types/nodemailer
 *   2) Añade al .env:
 *        SMTP_HOST=smtp.zoho.eu
 *        SMTP_PORT=465
 *        SMTP_USER=tu-cuenta@therevenuelabs.com
 *        SMTP_PASS=tu-contraseña-de-aplicacion
 *        SMTP_FROM="WordWars <tu-cuenta@therevenuelabs.com>"
 *   3) Descomenta el bloque marcado "ENVÍO REAL" más abajo.
 */

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

const isSmtpConfigured = (): boolean =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export async function sendEmail(message: EmailMessage): Promise<void> {
  if (!isSmtpConfigured()) {
    // ---- MODO DEV: log por consola ----
    console.log('\n📧 ───────────── EMAIL (modo dev, no enviado) ─────────────');
    console.log(`   Para:    ${message.to}`);
    console.log(`   Asunto:  ${message.subject}`);
    console.log('   ----------------------------------------------------------');
    console.log(message.text.split('\n').map((l) => '   ' + l).join('\n'));
    console.log('   ──────────────────────────────────────────────────────────\n');
    return;
  }

  // ---- ENVÍO REAL (descomentar tras instalar nodemailer) ----
  /*
  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: Number(process.env.SMTP_PORT || 465) === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: message.to,
    subject: message.subject,
    text: message.text,
    html: message.html
  });
  */
}

/**
 * Construye y envía el correo de reseteo de contraseña.
 */
export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const subject = 'Restablece tu contraseña de WordWars';
  const text =
    `Has solicitado restablecer tu contraseña de WordWars.\n\n` +
    `Abre este enlace para crear una nueva contraseña (caduca en 1 hora):\n` +
    `${resetUrl}\n\n` +
    `Si no fuiste tú, ignora este correo: tu contraseña no cambiará.`;
  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
      <h2 style="margin:0 0 12px">Restablece tu contraseña</h2>
      <p style="color:#555;line-height:1.6">Has solicitado restablecer tu contraseña de <strong>WordWars</strong>. Pulsa el botón para crear una nueva. El enlace caduca en 1 hora.</p>
      <p style="margin:28px 0">
        <a href="${resetUrl}" style="background:#111;color:#cdf24a;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:600;display:inline-block">Crear nueva contraseña</a>
      </p>
      <p style="color:#888;font-size:13px;line-height:1.6">Si no fuiste tú, ignora este correo: tu contraseña no cambiará.</p>
      <p style="color:#aaa;font-size:12px;word-break:break-all">${resetUrl}</p>
    </div>`;

  await sendEmail({ to, subject, text, html });
}
