/**
 * Comprobaciones sobre la dirección de email que se da al registrarse: formato,
 * normalización (para que no valgan las variantes de una misma bandeja), dominios
 * desechables y dominios que no pueden recibir correo.
 */
import dns from 'dns';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const disposableDomains = new Set<string>(require('disposable-email-domains') as string[]);

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export function isValidEmailFormat(email: string): boolean {
  return email.length <= 254 && EMAIL_FORMAT.test(email);
}

/**
 * Clave que identifica una bandeja: minúsculas, sin el `+alias` y, en Gmail, sin
 * puntos (`a.b+x@gmail.com` y `ab@googlemail.com` llegan al mismo sitio). Sirve
 * para detectar duplicados y para iniciar sesión; el correo se envía a la
 * dirección tal como la escribió la persona.
 */
export function normalizeEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) return email;

  let local = email.slice(0, at);
  let domain = email.slice(at + 1);

  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);

  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

export function isDisposableEmail(email: string): boolean {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  return disposableDomains.has(domain);
}

const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('DNS_TIMEOUT')), ms))]);

/**
 * ¿Existe el dominio y puede recibir correo? Solo dice que no cuando el DNS
 * responde con seguridad que no hay registros; ante un fallo o un timeout del
 * DNS deja pasar, para que un problema de red no impida registrarse.
 */
export async function domainCanReceiveMail(email: string): Promise<boolean> {
  const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase();
  const notFound = (err: unknown): boolean => {
    const code = (err as NodeJS.ErrnoException)?.code;
    return code === 'ENOTFOUND' || code === 'ENODATA';
  };

  try {
    const mx = await withTimeout(dns.promises.resolveMx(domain), 3000);
    if (mx.length > 0) return true;
  } catch (err) {
    if (!notFound(err)) return true;
  }

  // Sin MX, el estándar admite el correo en el propio dominio si tiene dirección IP.
  try {
    const a = await withTimeout(dns.promises.resolve4(domain), 3000);
    return a.length > 0;
  } catch (err) {
    return !notFound(err);
  }
}
