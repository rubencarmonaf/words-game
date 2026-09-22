import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import path from 'path';
import fs from 'fs';

// Import models
import User, { eloChangeFor } from './models/User';
import Game from './models/Game';
import Friendship from './models/Friendship';
import DailyChallenge from './models/DailyChallenge';
import DailyChallengeCompletion from './models/DailyChallengeCompletion';
import Message from './models/Message';

// Import services
import { dictionaryService } from './utils/dictionary';
import { sendPasswordResetEmail, sendVerificationEmail, isEmailConfigured, warnAboutEmailConfig } from './utils/email';
import { normalizeEmail, isValidEmailFormat, isDisposableEmail, domainCanReceiveMail } from './utils/emailAddress';
import { stripAccents } from './utils/text';

// Import types
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  AuthResponse, 
  RegisterResponse,
  IUser,
  WordValidationResponse,
  MatchmakingPlayer,
  AuthenticatedSocket,
  SocketEvents,
  DailyChallengeResponse,
  sanitizeAvatarOptions
} from './types';

dotenv.config();

// Sin esto, en producción se firmarían los tokens con la clave de ejemplo del
// código (`your-secret-key`) y cualquiera podría fabricar una sesión válida.
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET es obligatorio en producción');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);

// Detrás del proxy de Render la petición llega por HTTP desde una IP interna: sin
// esto, req.ip sería siempre la del proxy (y el límite de intentos por IP pararía a
// todo el mundo a la vez) y req.protocol sería siempre "http".
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Orígenes que pueden llamar a la API desde un navegador. En producción la web y la
// API comparten origen (el navegador no necesita CORS), así que solo se admite el
// dominio público; en desarrollo, el servidor de Angular. Las peticiones sin cabecera
// Origin (curl, scripts, otros servidores) no pasan por CORS y no se ven afectadas.
const allowedOrigins: string[] = [];
try {
  if (process.env.CLIENT_URL) allowedOrigins.push(new URL(process.env.CLIENT_URL).origin);
} catch {
  console.warn('⚠️  CLIENT_URL no es una URL válida; se ignora para CORS');
}
if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:4200', 'http://127.0.0.1:4200', 'http://localhost:3000', 'http://localhost:5173');
}
const corsOrigin = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void): void => {
  callback(null, !origin || allowedOrigins.includes(origin));
};

const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"]
  }
});

// Middleware
// Cabeceras de seguridad. La CSP por defecto es la más estricta posible (aplica a
// las respuestas de la API); las páginas de la web la sustituyen por la suya con los
// hashes de sus scripts en línea (ver sendPage). Las imágenes se sirven a cualquier
// origen: son públicas y las usan las vistas previas de enlaces.
app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Límites de intentos en los endpoints de cuenta, contra fuerza bruta y abuso. Se
// guardan en memoria: valen porque solo hay una instancia, y se reinician con ella.
const limitedResponse = (message: string) => (_req: express.Request, res: express.Response): void => {
  res.status(429).json({ success: false, message });
};
const makeLimiter = (windowMs: number, limit: number, message: string, extra: { skipSuccessfulRequests?: boolean; key?: (req: express.Request) => string } = {}) =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: extra.skipSuccessfulRequests ?? false,
    ...(extra.key ? { keyGenerator: extra.key, validate: { keyGeneratorIpFallback: false } } : {}),
    handler: limitedResponse(message)
  });
const TOO_MANY = 'Demasiados intentos. Inténtalo de nuevo en unos minutos.';
// Login: por IP (varios intentos desde un mismo sitio) y por cuenta (varias IPs contra
// un mismo email). Los inicios de sesión correctos no cuentan.
const loginLimiterByIp = makeLimiter(15 * 60 * 1000, 10, TOO_MANY, { skipSuccessfulRequests: true });
const loginLimiterByEmail = makeLimiter(15 * 60 * 1000, 10, TOO_MANY, {
  skipSuccessfulRequests: true,
  key: (req) => String(req.body?.email ?? '').toLowerCase().trim() || 'sin-email'
});
const registerLimiter = makeLimiter(60 * 60 * 1000, 10, 'Demasiados registros desde esta conexión. Inténtalo más tarde.');
const forgotPasswordLimiter = makeLimiter(60 * 60 * 1000, 5, TOO_MANY);
const resetPasswordLimiter = makeLimiter(60 * 60 * 1000, 10, TOO_MANY);
const verifyEmailLimiter = makeLimiter(60 * 60 * 1000, 30, TOO_MANY);
const resendVerificationLimiter = makeLimiter(60 * 60 * 1000, 5, TOO_MANY);

// Database connection
const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/wordwars';
    await mongoose.connect(mongoURI);
    console.log('✅ MongoDB conectado');
  } catch (error) {
    console.error('❌ Error conectando a MongoDB:', error);
    console.log('💡 Soluciones:');
    console.log('   1. Instalar MongoDB: https://www.mongodb.com/try/download/community');
    console.log('   2. Usar MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
    console.log('   3. Usar Docker: docker-compose up -d');
    process.exit(1);
  }
};

// Authentication middleware
const authenticateToken = (req: any, res: express.Response, next: express.NextFunction): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ success: false, message: 'Token requerido' });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err: any, user: any) => {
    if (err) {
      res.status(403).json({ success: false, message: 'Token inválido' });
      return;
    }
    req.user = user as { userId: string; username: string };
    next();
  });
};

// API Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Servidor funcionando' });
});

// ---------- Verificación de email ----------
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
// Una cuenta sin verificar se borra sola pasado este tiempo (índice TTL del modelo).
const UNVERIFIED_ACCOUNT_TTL_MS = 48 * 60 * 60 * 1000;
const VERIFY_RESEND_COOLDOWN_MS = 60 * 1000;

// Se exige confirmar el email en cuanto hay forma de mandarlo (o en desarrollo, donde el
// enlace sale por la consola). En producción sin RESEND_API_KEY no se exige: nadie podría
// recibir el enlace y la web quedaría cerrada a las cuentas nuevas.
const emailVerificationRequired = (): boolean => isEmailConfigured() || process.env.NODE_ENV !== 'production';

const clientBaseUrl = (): string => (process.env.CLIENT_URL || 'http://localhost:4200').replace(/\/+$/, '');

const sha256 = (value: string): string => crypto.createHash('sha256').update(value).digest('hex');

// Se busca por la clave normalizada (a.b+x@gmail.com == ab@gmail.com) y, por si la cuenta
// es anterior a que existiera, también por la dirección tal cual.
const findUserByEmail = (email: string) => {
  const lower = email.trim().toLowerCase();
  return User.findOne({ $or: [{ emailKey: normalizeEmail(lower) }, { email: lower }] });
};

const signSession = (user: IUser): AuthResponse => ({
  token: jwt.sign({ userId: user._id, username: user.username }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '24h' }),
  user: (user as any).toPublicJSON()
});

/** Genera un token nuevo (solo se guarda su hash), lo guarda y manda el enlace.
 * Devuelve si el correo salió; la cuenta queda guardada en cualquier caso. */
async function startEmailVerification(user: IUser): Promise<boolean> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationToken = sha256(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFY_TTL_MS);
  user.emailVerificationSentAt = new Date();
  user.unverifiedExpiresAt = new Date(Date.now() + UNVERIFIED_ACCOUNT_TTL_MS);
  await user.save();

  try {
    await sendVerificationEmail(user.email, user.username, `${clientBaseUrl()}/auth/verify-email?token=${rawToken}`);
    return true;
  } catch (mailError) {
    console.error('Error enviando email de verificación:', mailError);
    return false;
  }
}

const isDuplicateKeyError = (error: unknown): boolean => (error as { code?: number })?.code === 11000;

// Auth routes
app.post('/api/register', registerLimiter, async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
      return;
    }
    if (typeof username !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Datos no válidos' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = username.trim();
    if (!isValidEmailFormat(cleanEmail)) {
      res.status(400).json({ success: false, message: 'Introduce un email válido' });
      return;
    }
    if (isDisposableEmail(cleanEmail)) {
      res.status(400).json({ success: false, message: 'No se admiten emails temporales. Usa tu email personal.' });
      return;
    }
    if (!(await domainCanReceiveMail(cleanEmail))) {
      res.status(400).json({ success: false, message: 'Ese dominio de email no existe o no puede recibir correo' });
      return;
    }

    const emailKey = normalizeEmail(cleanEmail);
    const verificationRequired = emailVerificationRequired();

    // Una cuenta pendiente de verificar no reserva el email: si su dueño real se registra,
    // pasa por delante (así nadie puede bloquear la dirección de otra persona).
    await User.deleteMany({
      emailVerified: false,
      unverifiedExpiresAt: { $ne: null },
      $or: [{ emailKey }, { email: cleanEmail }]
    });

    // Quien se equivocó de email al registrarse puede repetirlo con el mismo usuario y la
    // misma contraseña: sustituye a su cuenta pendiente. Sin la contraseña no se toca.
    const pendingSameName = await User.findOne({
      username: cleanUsername,
      emailVerified: false,
      unverifiedExpiresAt: { $ne: null }
    });
    if (pendingSameName && (await pendingSameName.comparePassword(password))) {
      await pendingSameName.deleteOne();
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ emailKey }, { email: cleanEmail }, { username: cleanUsername }]
    });

    if (existingUser) {
      res.status(400).json({ success: false, message: 'Usuario ya existe' });
      return;
    }

    // Create user (elo/gamesPlayed/gamesWon start at the schema defaults)
    const user = new User({
      username: cleanUsername,
      email: cleanEmail,
      password // Will be hashed by pre-save middleware
    });

    if (verificationRequired) {
      // Sin sesión hasta confirmar el email: el token llega al abrir el enlace.
      const emailSent = await startEmailVerification(user);
      const response: RegisterResponse = { verificationRequired: true, email: user.email, emailSent };
      res.status(201).json({ success: true, data: response });
      return;
    }

    await user.save();
    const response: RegisterResponse = signSession(user);
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      res.status(400).json({ success: false, message: 'Usuario ya existe' });
      return;
    }
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/api/login', loginLimiterByIp, loginLimiterByEmail, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
      return;
    }

    const user = await findUserByEmail(email);
    if (!user) {
      res.status(400).json({ success: false, message: 'Credenciales inválidas' });
      return;
    }

    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      res.status(400).json({ success: false, message: 'Credenciales inválidas' });
      return;
    }

    // Se comprueba después de la contraseña: quien no la sabe no averigua si la cuenta existe.
    if (!user.emailVerified && emailVerificationRequired()) {
      res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Confirma tu email para poder iniciar sesión. Te enviamos un enlace al registrarte.'
      });
      return;
    }

    const response: AuthResponse = signSession(user);
    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Confirmar el email con el token del enlace. Es un POST (lo lanza la página, no el GET
// del enlace) para que los antivirus de correo que "abren" los enlaces no lo consuman.
app.post('/api/verify-email', verifyEmailLimiter, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      res.status(400).json({ success: false, code: 'INVALID_TOKEN', message: 'Enlace no válido' });
      return;
    }

    const user = await User.findOne({
      emailVerificationToken: sha256(token),
      emailVerificationExpires: { $gt: new Date() }
    });
    if (!user) {
      res.status(400).json({
        success: false,
        code: 'INVALID_TOKEN',
        message: 'El enlace no es válido o ha caducado. Inicia sesión para recibir uno nuevo.'
      });
      return;
    }

    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    user.unverifiedExpiresAt = null;
    await user.save();

    const response: AuthResponse = signSession(user);
    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error en verify-email:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Reenviar el enlace de verificación. Respuesta genérica (no revela si la cuenta existe) y
// con un mínimo entre envíos para que no se use para mandar correo a mansalva.
app.post('/api/resend-verification', resendVerificationLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, message: 'Email requerido' });
      return;
    }

    const genericResponse = {
      success: true,
      data: { message: 'Si la cuenta está pendiente de verificar, te hemos enviado un nuevo enlace.' }
    };

    const user = await findUserByEmail(email);
    const sentRecently =
      user?.emailVerificationSentAt && Date.now() - user.emailVerificationSentAt.getTime() < VERIFY_RESEND_COOLDOWN_MS;
    if (!user || user.emailVerified || sentRecently) {
      res.json(genericResponse);
      return;
    }

    await startEmailVerification(user);
    res.json(genericResponse);
  } catch (error) {
    console.error('Error en resend-verification:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Solicitar reseteo de contraseña: genera token, lo guarda hasheado y envía el email
app.post('/api/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== 'string') {
      res.status(400).json({ success: false, message: 'Email requerido' });
      return;
    }

    const user = await findUserByEmail(email);

    // Respuesta genérica: no revelamos si el email existe o no (evita enumeración de cuentas)
    const genericResponse = {
      success: true,
      data: { message: 'Si el email está registrado, recibirás un enlace para restablecer tu contraseña.' }
    };

    if (!user) {
      res.json(genericResponse);
      return;
    }

    // Token en claro (va en el enlace) + hash sha256 que es lo único que guardamos
    const rawToken = crypto.randomBytes(32).toString('hex');

    user.resetPasswordToken = sha256(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();

    const resetUrl = `${clientBaseUrl()}/?reset=${rawToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl);
    } catch (mailError) {
      console.error('Error enviando email de reseteo:', mailError);
      // No exponemos el fallo de email al cliente; el token ya está guardado
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('Error en forgot-password:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Establecer nueva contraseña con el token recibido por email
app.post('/api/reset-password', resetPasswordLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password || typeof token !== 'string' || typeof password !== 'string') {
      res.status(400).json({ success: false, message: 'Token y contraseña requeridos' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    const user = await User.findOne({
      resetPasswordToken: sha256(token),
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({ success: false, message: 'El enlace no es válido o ha caducado. Solicita uno nuevo.' });
      return;
    }

    user.password = password; // el hook pre-save lo hashea
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    // Abrir este enlace demuestra que la bandeja es suya: cuenta también como verificación.
    user.emailVerified = true;
    user.emailVerificationToken = null;
    user.emailVerificationExpires = null;
    user.unverifiedExpiresAt = null;
    await user.save();

    res.json({ success: true, data: { message: 'Contraseña actualizada. Ya puedes iniciar sesión.' } });
  } catch (error) {
    console.error('Error en reset-password:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Word validation
app.post('/api/validate-word', async (req, res) => {
  try {
    const { word } = req.body;
    
    if (!word || typeof word !== 'string') {
      res.status(400).json({ success: false, message: 'Palabra requerida' });
      return;
    }

    const isValid = await dictionaryService.validateWord(word);
    const response: WordValidationResponse = { valid: isValid };
    
    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error validando palabra:', error);
    res.status(500).json({ success: false, message: 'Error validando palabra' });
  }
});

// Test RAE API connectivity
app.get('/api/test-dictionary', async (req, res) => {
  try {
    const isConnected = await dictionaryService.testRAEAPIConnectivity();
    const cacheStats = dictionaryService.getCacheStats();
    
    res.json({ 
      success: true, 
      data: { 
        raeApiConnected: isConnected,
        cacheSize: cacheStats.size,
        validationMethod: dictionaryService.getValidationMethod()
      } 
    });
  } catch (error) {
    console.error('Error probando RAE API:', error);
    res.status(500).json({ success: false, message: 'Error probando conectividad' });
  }
});

// Test word validation
app.post('/api/test-word', async (req, res) => {
  try {
    const { word } = req.body;
    
    if (!word) {
      res.status(400).json({ success: false, message: 'Palabra requerida' });
      return;
    }

    console.log(`Testing word validation for: "${word}"`);
    const isValid = await dictionaryService.validateWord(word);
    const cacheStats = dictionaryService.getCacheStats();
    
    res.json({ 
      success: true, 
      data: { 
        word,
        valid: isValid,
        cacheSize: cacheStats.size
      } 
    });
  } catch (error) {
    console.error('Error testing word:', error);
    res.status(500).json({ success: false, message: 'Error testing word' });
  }
});

// Clear dictionary cache for new game
app.post('/api/clear-cache', async (req, res) => {
  try {
    dictionaryService.clearCacheForNewGame();
    res.json({ 
      success: true, 
      message: 'Cache cleared for new game' 
    });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ success: false, message: 'Error clearing cache' });
  }
});

// User profile
app.get('/api/profile', authenticateToken, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    res.json({ success: true, data: user.toPublicJSON() });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Perfil público de otro usuario (stats y avatar, nunca el email). Solo se puede ver el de un
// amigo, o el propio: no es una forma de curiosear a cualquiera.
app.get('/api/users/:userId/profile', authenticateToken, async (req: any, res) => {
  try {
    const targetId = String(req.params.userId);

    if (targetId !== req.user.userId) {
      const status = await (Friendship as any).getFriendshipStatus(req.user.userId, targetId);
      if (status !== 'accepted') {
        res.status(403).json({ success: false, message: 'Solo puedes ver el perfil de tus amigos' });
        return;
      }
    }

    const user = mongoose.isValidObjectId(targetId) ? await User.findById(targetId) : null;
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    res.json({ success: true, data: user.toPublicJSON() });
  } catch (error) {
    console.error('Error obteniendo el perfil de un usuario:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Actualizar perfil: nombre de usuario y/o personalización del avatar
app.put('/api/profile', authenticateToken, async (req: any, res) => {
  try {
    const { username, avatar } = req.body;

    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    if (username !== undefined) {
      const trimmed = String(username).trim();
      if (trimmed.length < 3 || trimmed.length > 20) {
        res.status(400).json({ success: false, message: 'El nombre de usuario debe tener entre 3 y 20 caracteres' });
        return;
      }
      if (trimmed !== user.username) {
        const existing = await User.findOne({ username: trimmed });
        if (existing) {
          res.status(400).json({ success: false, message: 'Ese nombre de usuario ya está en uso' });
          return;
        }
        user.username = trimmed;
      }
    }

    if (avatar !== undefined) {
      // sanitizeAvatarOptions descarta cualquier campo/valor fuera de las listas
      // permitidas y rellena el resto con los valores por defecto — nunca falla,
      // así que el cliente siempre recibe de vuelta un avatar completo y válido
      user.avatar = sanitizeAvatarOptions(avatar);
    }

    await user.save();

    res.json({ success: true, data: user.toPublicJSON() });
  } catch (error) {
    console.error('Error actualizando perfil:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Friends system
app.get('/api/friends', authenticateToken, async (req: any, res) => {
  try {
    const friends = await Friendship.getFriends(req.user.userId);
    const withPresence = friends.map((friend: any) => ({
      ...friend,
      id: friend.id.toString(),
      online: isUserOnline(friend.id.toString())
    }));
    res.json({ success: true, data: withPresence });
  } catch (error) {
    console.error('Error obteniendo amigos:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Solicitudes de amistad pendientes recibidas por el usuario autenticado
app.get('/api/friends/requests', authenticateToken, async (req: any, res) => {
  try {
    const requests = await (Friendship as any).getPendingRequests(req.user.userId);
    const data = requests.map((r: any) => ({
      id: r._id.toString(),
      from: { id: r.requester._id.toString(), username: r.requester.username }
    }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error obteniendo solicitudes de amistad:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Solicitudes de amistad pendientes que ha enviado el usuario (aún sin responder)
app.get('/api/friends/sent', authenticateToken, async (req: any, res) => {
  try {
    const sent = await (Friendship as any)
      .find({ requester: req.user.userId, status: 'pending' })
      .populate('addressee', 'username');
    const data = sent
      .filter((r: any) => r.addressee)
      .map((r: any) => ({ id: r._id.toString(), to: { id: r.addressee._id.toString(), username: r.addressee.username } }));
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error obteniendo solicitudes enviadas:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Cancelar una solicitud enviada que sigue sin responder. A quien la recibió se le quita de su
// lista al momento.
app.delete('/api/friends/requests/:requestId', authenticateToken, async (req: any, res) => {
  try {
    const requestId = String(req.params.requestId);
    if (!mongoose.isValidObjectId(requestId)) {
      res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
      return;
    }

    const removed = await (Friendship as any).findOneAndDelete({
      _id: requestId,
      requester: req.user.userId,
      status: 'pending'
    });
    if (!removed) {
      res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
      return;
    }

    emitToUser(String(removed.addressee), 'friend:request-cancelled', { id: requestId });
    res.json({ success: true, message: 'Solicitud cancelada' });
  } catch (error) {
    console.error('Error cancelando solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Aceptar o rechazar una solicitud de amistad pendiente
app.post('/api/friends/respond', authenticateToken, async (req: any, res) => {
  try {
    const { requestId, accept } = req.body;
    if (!requestId || typeof accept !== 'boolean') {
      res.status(400).json({ success: false, message: 'requestId y accept son requeridos' });
      return;
    }

    const friendship = await (Friendship as any).findById(requestId);
    if (!friendship || friendship.addressee !== req.user.userId || friendship.status !== 'pending') {
      res.status(404).json({ success: false, message: 'Solicitud no encontrada' });
      return;
    }

    friendship.status = accept ? 'accepted' : 'declined';
    if (!accept) friendship.respondedAt = new Date();
    await friendship.save();

    // Quien envió la solicitud se entera en vivo de que la aceptaron (para que su lista de
    // amigos se actualice sola). El rechazo no se notifica.
    if (accept) {
      emitToUser(String(friendship.requester), 'friend:accepted', { id: req.user.userId, username: req.user.username });
    }

    res.json({ success: true, message: accept ? 'Solicitud aceptada' : 'Solicitud rechazada' });
  } catch (error) {
    console.error('Error respondiendo solicitud de amistad:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Eliminar a un amigo. La amistad es una sola para los dos, así que al borrarla desaparece
// de ambas listas, y sin ella tampoco se pueden mandar mensajes ni invitaciones (todo eso
// comprueba que la amistad exista). No se avisa con un mensaje a la otra persona: solo se
// le actualiza la lista en vivo. Los mensajes anteriores no se borran.
app.delete('/api/friends/:friendId', authenticateToken, async (req: any, res) => {
  try {
    const friendId = String(req.params.friendId);
    const me = req.user.userId;

    const removed = await (Friendship as any).findOneAndDelete({
      status: 'accepted',
      $or: [
        { requester: me, addressee: friendId },
        { requester: friendId, addressee: me }
      ]
    });
    if (!removed) {
      res.status(404).json({ success: false, message: 'No sois amigos' });
      return;
    }

    emitToUser(friendId, 'friend:removed', { id: me });
    res.json({ success: true, message: 'Amigo eliminado' });
  } catch (error) {
    console.error('Error eliminando amigo:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Tiempo que tiene que pasar antes de dejar reenviar una solicitud que rechazaron.
const FRIEND_REQUEST_RETRY_MS = 24 * 60 * 60 * 1000;

app.post('/api/friends/request', authenticateToken, async (req: any, res) => {
  try {
    const { friendUsername } = req.body;
    
    if (!friendUsername) {
      res.status(400).json({ success: false, message: 'Nombre de usuario requerido' });
      return;
    }
    
    const friend = await User.findOne({ username: friendUsername });
    if (!friend) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    if (friend._id.toString() === req.user.userId) {
      res.status(400).json({ success: false, message: 'No puedes agregarte a ti mismo' });
      return;
    }

    // Check if friendship already exists
    const existingFriendship = await (Friendship as any).findOne({
      $or: [
        { requester: req.user.userId, addressee: friend._id.toString() },
        { requester: friend._id.toString(), addressee: req.user.userId }
      ]
    });

    let friendship = existingFriendship;

    if (existingFriendship) {
      const iAmRequester = existingFriendship.requester === req.user.userId;

      if (existingFriendship.status === 'accepted') {
        res.status(400).json({ success: false, message: 'Ya sois amigos' });
        return;
      }
      if (existingFriendship.status === 'pending') {
        res.status(400).json({
          success: false,
          message: iAmRequester
            ? 'Ya enviaste una solicitud a este usuario'
            : 'Este usuario ya te envió una solicitud: acéptala desde tu lista de amigos'
        });
        return;
      }
      if (existingFriendship.status !== 'declined') {
        res.status(400).json({ success: false, message: 'No puedes enviar una solicitud a este usuario' });
        return;
      }

      // Rechazada: quien rechazó puede cambiar de opinión cuando quiera; a quien fue
      // rechazado se le deja reintentarlo pasado un tiempo, para que no sea un acoso.
      if (iAmRequester && existingFriendship.respondedAt) {
        const retryAt = existingFriendship.respondedAt.getTime() + FRIEND_REQUEST_RETRY_MS;
        if (Date.now() < retryAt) {
          const hours = Math.ceil((retryAt - Date.now()) / (60 * 60 * 1000));
          res.status(400).json({ success: false, message: `Esta solicitud no se aceptó. Podrás volver a enviarla en unas ${hours} h` });
          return;
        }
      }

      // Se reutiliza el mismo registro (el par es único), con quien envía ahora como solicitante.
      existingFriendship.requester = req.user.userId;
      existingFriendship.addressee = friend._id.toString();
      existingFriendship.status = 'pending';
      existingFriendship.respondedAt = undefined;
    } else {
      friendship = new (Friendship as any)({
        requester: req.user.userId,
        addressee: friend._id.toString(),
        status: 'pending'
      });
    }

    await friendship.save();

    // Al destinatario le aparece al momento (aviso y solicitud en su lista de amigos), sin
    // tener que recargar. Si no está conectado, la ve al entrar: la solicitud queda guardada.
    emitToUser(friend._id.toString(), 'friend:request', {
      id: friendship._id.toString(),
      from: { id: req.user.userId, username: req.user.username }
    });

    res.json({ success: true, message: 'Solicitud enviada' });
  } catch (error) {
    console.error('Error enviando solicitud:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Mensajes directos (chat 1:1) — persistidos siempre, para que un mensaje
// mandado mientras el destinatario está desconectado no se pierda: al volver
// a conectarse o simplemente reabrir el hilo, ahí sigue.

// Conteo de mensajes no leídos por remitente, para el badge del widget flotante
app.get('/api/messages/unread-counts', authenticateToken, async (req: any, res) => {
  try {
    // Solo de amigos actuales: los mensajes de alguien a quien se eliminó no deben seguir
    // sumando en el aviso, ya que su chat no se puede abrir para leerlos.
    const friends = await (Friendship as any).getFriends(req.user.userId);
    const friendIds = friends.map((f: any) => f.id.toString());
    const counts = await (Message as any).aggregate([
      { $match: { to: req.user.userId, read: false, from: { $in: friendIds } } },
      { $group: { _id: '$from', count: { $sum: 1 } } }
    ]);
    const data: Record<string, number> = {};
    for (const row of counts) data[row._id] = row.count;
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error obteniendo mensajes no leídos:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Historial de un hilo con un amigo — abrir el hilo marca como leído todo lo recibido
app.get('/api/messages/:friendId', authenticateToken, async (req: any, res) => {
  try {
    const { friendId } = req.params;

    const status = await (Friendship as any).getFriendshipStatus(req.user.userId, friendId);
    if (status !== 'accepted') {
      res.status(403).json({ success: false, message: 'Solo puedes chatear con amigos' });
      return;
    }

    const messages = await (Message as any)
      .find({
        $or: [
          { from: req.user.userId, to: friendId },
          { from: friendId, to: req.user.userId }
        ]
      })
      .sort({ createdAt: 1 })
      .limit(200);

    await (Message as any).updateMany({ from: friendId, to: req.user.userId, read: false }, { read: true });

    res.json({
      success: true,
      data: messages.map(serializeMessage)
    });
  } catch (error) {
    console.error('Error obteniendo historial de mensajes:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Sockets activos por usuario autenticado (independiente de la cola de
// matchmaking, para poder localizar a un jugador durante toda la vida de una
// partida o lobby). Un usuario puede tener más de un socket vivo a la vez —
// p.ej. la app principal más una ventana de chat abierta aparte — así que
// esto es un Set por usuario, no un único socketId; ver los helpers debajo.
const userSockets = new Map<string, Set<string>>();

function addUserSocket(userId: string, socketId: string): void {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId)!.add(socketId);
}

// Devuelve true si ese era el último socket de este usuario (es decir, ahora
// está realmente desconectado) — el disconnect handler solo debe forfeitear
// partidas/lobbies/avisar "offline" cuando esto da true, no en cada pestaña
// que se cierre mientras queden otras abiertas.
function removeUserSocket(userId: string, socketId: string): boolean {
  const sockets = userSockets.get(userId);
  if (!sockets) return true;
  sockets.delete(socketId);
  if (sockets.size === 0) {
    userSockets.delete(userId);
    return true;
  }
  return false;
}

function isUserOnline(userId: string): boolean {
  return (userSockets.get(userId)?.size ?? 0) > 0;
}

function emitToUser(userId: string, event: string, payload?: unknown): void {
  const sockets = userSockets.get(userId);
  if (!sockets) return;
  for (const socketId of sockets) io.to(socketId).emit(event, payload);
}

interface LobbyPlayer {
  userId: string;
  username: string;
}

interface LobbyState {
  lobbyId: string;
  hostId: string;
  players: LobbyPlayer[];
  invited: Set<string>;
  // userIds de los invitados: a ellos se les avisa cuando el lobby se cierra,
  // para desactivar la invitación que quedó en su chat
  inviteeIds: Set<string>;
  started: boolean;
}

// Lobbies "Con amigos" en espera de arrancar, en memoria igual que la cola de
// matchmaking — no necesitan persistencia, solo existen mientras se organiza la partida
const lobbies = new Map<string, LobbyState>();

interface FinishedLobbyGame {
  hostId: string;
  players: LobbyPlayer[];
  rematchLobbyId?: string;
}

// Partidas "con amigos" ya terminadas, recordadas brevemente para que
// "Jugar de Nuevo" pueda devolver a todo el grupo al mismo lobby en vez de
// que cada uno cree uno nuevo por su cuenta — ver lobby:rematch más abajo.
const finishedLobbyGames = new Map<string, FinishedLobbyGame>();

function serializeLobby(lobby: LobbyState) {
  return {
    lobbyId: lobby.lobbyId,
    hostId: lobby.hostId,
    players: lobby.players,
    playerCount: lobby.players.length
  };
}

// Matchmaking
const matchmakingQueue = new Map<string, MatchmakingPlayer>();

// Emparejamiento ya hecho que espera a que acabe la pantalla VS para arrancar. Existe para poder
// cancelarlo si alguien sale durante esos segundos, y para no arrancar una partida a la que uno de
// los dos ya no está conectado.
interface PendingMatch {
  gameId: string;
  players: [MatchmakingPlayer, MatchmakingPlayer];
  cancelled: boolean;
}
const pendingMatches = new Map<string, PendingMatch>();

// Un jugador en cola sin socket conectado (el navegador perdió la conexión y no la recuperó) no se
// empareja: el rival vería la pantalla VS y una partida contra alguien que no está. Si sigue sin
// aparecer pasado este tiempo, se le saca de la cola.
const MATCHMAKING_STALE_MS = 20_000;

// Devuelve a la cola a quien seguía conectado cuando se cancela un emparejamiento y le avisa
// para que su pantalla vuelva a "buscando". Conserva su hora de entrada: no pierde su turno.
function requeueAndNotify(player: MatchmakingPlayer): void {
  if (!isUserOnline(player.userId)) return;
  matchmakingQueue.set(player.userId, { ...player, lastSeen: Date.now() });
  emitToUser(player.userId, 'matchCancelled');
}

function cancelPendingMatch(pending: PendingMatch, leaverId: string): void {
  pending.cancelled = true;
  for (const p of pending.players) {
    if (pendingMatches.get(p.userId) === pending) pendingMatches.delete(p.userId);
    if (p.userId !== leaverId) requeueAndNotify(p);
  }
}

app.post('/api/matchmaking/join', authenticateToken, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }
    
    // Add to matchmaking queue (si ya estaba, conserva su hora de entrada)
    matchmakingQueue.set(req.user.userId, {
      userId: req.user.userId,
      username: user.username,
      elo: user.elo,
      avatar: user.avatar,
      socketId: undefined,
      queuedAt: matchmakingQueue.get(req.user.userId)?.queuedAt ?? Date.now()
    });

    res.json({ success: true, message: 'Buscando partida...' });
  } catch (error) {
    console.error('Error uniéndose a matchmaking:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/api/matchmaking/leave', authenticateToken, (req: any, res) => {
  // Salir durante la pantalla VS cancela el emparejamiento (antes la partida arrancaba igual).
  const pending = pendingMatches.get(req.user.userId);
  if (pending) cancelPendingMatch(pending, req.user.userId);
  matchmakingQueue.delete(req.user.userId);
  res.json({ success: true, message: 'Saliendo de la cola' });
});

// Daily Challenge endpoints
app.get('/api/daily-challenge', authenticateToken, async (req: any, res) => {
  try {
    // Get today's challenge
    const challenge = await (DailyChallenge as any).getTodaysChallenge();
    
    // Check if user has already completed today's challenge
    const hasCompleted = await (DailyChallengeCompletion as any).hasUserCompletedToday(req.user.userId);
    
    let wordsFound = [];
    if (hasCompleted) {
      const completion = await (DailyChallengeCompletion as any).findOne({ 
        userId: req.user.userId, 
        date: challenge.date 
      });
      wordsFound = completion?.wordsFound || [];
    }

    // Calculate time until next challenge (next day at 00:00)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeUntilNext = tomorrow.getTime() - now.getTime();
    const totalSeconds = Math.floor(timeUntilNext / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const response: DailyChallengeResponse = {
      challenge: {
        _id: challenge._id.toString(),
        date: challenge.date,
        prefix: challenge.prefix,
        createdAt: challenge.createdAt
      },
      isCompleted: hasCompleted,
      wordsFound: hasCompleted ? wordsFound : undefined,
      timeUntilNext: {
        hours,
        minutes,
        seconds,
        totalSeconds
      }
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error obteniendo reto diario:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/api/daily-challenge/complete', authenticateToken, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }

    // Check if user has already completed today's challenge
    const hasCompleted = await (DailyChallengeCompletion as any).hasUserCompletedToday(req.user.userId);
    if (hasCompleted) {
      res.status(400).json({ success: false, message: 'Ya completaste el reto de hoy' });
      return;
    }

    const { words } = req.body;
    
    if (!words || !Array.isArray(words) || words.length === 0) {
      res.status(400).json({ success: false, message: 'Debes enviar al menos una palabra' });
      return;
    }

    // Get today's challenge
    const challenge = await (DailyChallenge as any).getTodaysChallenge();
    
    // Validate words using dictionary service
    const validWords: string[] = [];
    for (const word of words) {
      if (typeof word === 'string' && word.length >= 3) {
        const upperWord = word.toUpperCase();
        // Check if word starts with the required prefix (ignoring accents)
        if (stripAccents(upperWord).startsWith(stripAccents(challenge.prefix))) {
          // Validate with dictionary service
          const isValid = await dictionaryService.validateWord(upperWord);
          if (isValid) {
            validWords.push(upperWord);
          }
        }
      }
    }

    // Check if user found at least 3 valid words
    if (validWords.length < 3) {
      res.status(400).json({ 
        success: false, 
        message: `Necesitas encontrar al menos 3 palabras válidas que empiecen con "${challenge.prefix}"` 
      });
      return;
    }

    // Create completion record (no ELO reward, just training)
    const completion = new (DailyChallengeCompletion as any)({
      userId: req.user.userId,
      date: challenge.date,
      wordsFound: validWords,
      rewardEarned: 0
    });
    await completion.save();

    res.json({ 
      success: true, 
      data: {
        wordsFound: validWords,
        message: `¡Reto completado! Encontraste ${validWords.length} palabras.`
      }
    });
  } catch (error) {
    console.error('Error completando reto diario:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// ---------- Partidas Versus y Con amigos (arbitradas por el servidor) ----------
const VERSUS_PREFIXES = ['de', 'con', 'pre', 'ex', 'in', 'ca', 'ma', 'pa', 'ba', 'to', 'ver', 'sal', 'fin', 'mar', 'sol', 'cor', 'ter', 'res'];
// Versus dura lo mismo que un entrenamiento en solo: partidas cortas para que
// encadenar una tras otra sea fácil. Debe coincidir con VERSUS_DURATION_SECONDS
// en el cliente (game.ts), que solo pinta el contador.
const VERSUS_DURATION_MS = 2 * 60 * 1000;
const LOBBY_DURATION_MS = 2 * 60 * 1000;
// Tiempo que se muestra la pantalla "VS" (rival, avatar, ELO en juego) entre
// que se encuentra partida y arranca de verdad.
const VERSUS_INTRO_MS = 5000;

// Partidas versus/amigos en curso: el documento Game vive en memoria durante la partida
// y se persiste en cada palabra/al terminar, evitando una relectura por jugada.
// hostId solo se rellena para partidas "con amigos" (versus no tiene anfitrión).
const activeGames = new Map<string, { gameDoc: any; timer: NodeJS.Timeout; hostId?: string; startedAt: number; durationMs: number }>();

// Margen antes de dar por abandonada una partida cuando el socket de un jugador se cae:
// en móvil es habitual perder la conexión unos segundos (cambio de red, pantalla apagada)
// y volver enseguida. Si vuelve dentro del margen, sigue jugando.
const DISCONNECT_GRACE_MS = 10_000;

// Cuando el jugador no tenía socket al arrancar la partida, o lo perdió durante ella, se
// comprueba pasado el margen si sigue sin conexión y solo entonces se le da por abandonado.
function forfeitIfStillOffline(gameId: string, userId: string): void {
  setTimeout(() => {
    if (isUserOnline(userId)) return;
    const active = activeGames.get(gameId);
    if (active && active.gameDoc.players.some((p: any) => p.userId === userId)) {
      finishGame(gameId, 'forfeit', userId);
    }
  }, DISCONNECT_GRACE_MS);
}

// Estado completo de una partida en curso para un jugador. Se envía al reconectar o al
// pedirlo: si el `gameStart` original se perdió (socket caído justo entonces), el cliente
// se pone al día con esto en vez de quedarse esperando para siempre.
function gameStatePayload(gameId: string, active: { gameDoc: any; startedAt: number; durationMs: number }, userId: string) {
  const players = active.gameDoc.players as { userId: string; username: string; words: string[]; score: number }[];
  return {
    gameId,
    prefix: active.gameDoc.prefix,
    gameType: active.gameDoc.gameType,
    // Las palabras solo de quien pide el estado; de los demás, solo su marcador
    players: players.map((p) => ({
      userId: p.userId,
      username: p.username,
      words: p.userId === userId ? (p.words ?? []) : [],
      score: p.score ?? 0
    })),
    remainingSeconds: Math.max(0, Math.round((active.startedAt + active.durationMs - Date.now()) / 1000)),
    resumed: true,
    me: userId
  };
}

function resyncActiveGame(userId: string): void {
  for (const [gameId, active] of activeGames) {
    if (active.gameDoc.players.some((p: any) => p.userId === userId)) {
      emitToUser(userId, 'gameStart', gameStatePayload(gameId, active, userId));
    }
  }
}

async function startVersusGame(gameId: string, player1: MatchmakingPlayer, player2: MatchmakingPlayer): Promise<void> {
  const prefix = VERSUS_PREFIXES[Math.floor(Math.random() * VERSUS_PREFIXES.length)];

  const gameDoc = new (Game as any)({
    gameId,
    players: [
      { userId: player1.userId, username: player1.username, words: [], score: 0 },
      { userId: player2.userId, username: player2.username, words: [], score: 0 }
    ],
    prefix,
    gameType: 'versus',
    duration: VERSUS_DURATION_MS / 1000
  });
  gameDoc.start();
  await gameDoc.save();

  const timer = setTimeout(() => { finishGame(gameId, 'timeout'); }, VERSUS_DURATION_MS);
  activeGames.set(gameId, { gameDoc, timer, startedAt: Date.now(), durationMs: VERSUS_DURATION_MS });

  const startPayload = {
    gameId,
    prefix,
    players: [
      { userId: player1.userId, username: player1.username },
      { userId: player2.userId, username: player2.username }
    ]
  };

  for (const player of [player1, player2]) {
    emitToUser(player.userId, 'gameStart', startPayload);
    // Sin socket ahora mismo: recibirá la partida al reconectar (ver authenticate) si
    // vuelve dentro del margen; si no, se le da por abandonada.
    if (!isUserOnline(player.userId)) forfeitIfStillOffline(gameId, player.userId);
  }
}

// Arranca una partida "Con amigos" (N jugadores, casual, sin ELO) a partir de
// un lobby ya lleno — reutiliza el mismo motor server-authoritative que
// startVersusGame en vez de duplicar la lógica de palabras/marcador.
async function startLobbyGame(lobby: LobbyState): Promise<void> {
  const gameId = lobby.lobbyId;
  const prefix = VERSUS_PREFIXES[Math.floor(Math.random() * VERSUS_PREFIXES.length)];

  const gameDoc = new (Game as any)({
    gameId,
    players: lobby.players.map((p) => ({ userId: p.userId, username: p.username, words: [], score: 0 })),
    prefix,
    gameType: 'lobby',
    duration: LOBBY_DURATION_MS / 1000
  });
  gameDoc.start();
  await gameDoc.save();

  const timer = setTimeout(() => { finishGame(gameId, 'timeout'); }, LOBBY_DURATION_MS);
  activeGames.set(gameId, { gameDoc, timer, hostId: lobby.hostId, startedAt: Date.now(), durationMs: LOBBY_DURATION_MS });

  const startPayload = {
    gameId,
    prefix,
    players: lobby.players.map((p) => ({ userId: p.userId, username: p.username }))
  };

  for (const p of lobby.players) {
    emitToUser(p.userId, 'gameStart', startPayload);
    if (!isUserOnline(p.userId)) forfeitIfStillOffline(gameId, p.userId);
  }
}

// Termina una partida versus (1v1) o "con amigos" (N jugadores). El ganador es
// quien más palabras válidas tiene al acabar el tiempo; en un abandono, quien
// abandona queda excluido de ganar pero la partida termina para todos por
// igual — no hay continuidad parcial para el resto (fuera de alcance por ahora).
async function finishGame(gameId: string, reason: 'timeout' | 'forfeit', forfeitedBy?: string): Promise<void> {
  const active = activeGames.get(gameId);
  if (!active) return;
  activeGames.delete(gameId);
  clearTimeout(active.timer);

  const { gameDoc } = active;
  const players = gameDoc.players;
  const isVersus = gameDoc.gameType === 'versus';

  let winnerId: string | null;
  if (reason === 'forfeit' && forfeitedBy) {
    const contenders = players.filter((p: any) => p.userId !== forfeitedBy);
    const sorted = [...contenders].sort((a: any, b: any) => b.score - a.score);
    winnerId = sorted[0]?.userId ?? null;
  } else {
    const sorted = [...players].sort((a: any, b: any) => b.score - a.score);
    // Empate (incl. entre más de dos jugadores): nadie gana, sin cambio de ELO
    winnerId = sorted.length && sorted[0].score > (sorted[1]?.score ?? -1) ? sorted[0].userId : null;
  }

  gameDoc.end(winnerId || undefined);
  await gameDoc.save();

  // El ELO solo existe en versus (1v1 rankeado); "con amigos" nunca lo toca.
  // eloResults guarda antes/después por jugador para mostrarlo en pantalla; en
  // un empate (sin ganador) no se mueve nada pero igualmente se informa.
  const eloResults = new Map<string, { before: number; after: number; change: number }>();
  if (isVersus) {
    const users = await Promise.all(players.map((p: any) => User.findById(p.userId)));
    if (users.every(Boolean)) {
      const before = users.map((u: any) => u.elo);
      if (winnerId) {
        users.forEach((user: any, i: number) => {
          user.updateElo(before[1 - i], players[i].userId === winnerId);
        });
        await Promise.all(users.map((u: any) => u.save()));
      }
      users.forEach((user: any, i: number) => {
        eloResults.set(players[i].userId, { before: before[i], after: user.elo, change: user.elo - before[i] });
      });
    }
  }

  const winnerUsername = winnerId ? players.find((p: any) => p.userId === winnerId)?.username ?? null : null;
  const finalScores = [...players]
    .sort((a: any, b: any) => b.score - a.score)
    .map((p: any) => ({ username: p.username, score: p.score }));

  for (const p of players) {
    emitToUser(p.userId, 'gameEnd', {
      winner: winnerUsername,
      finalScores,
      won: winnerId === p.userId,
      elo: eloResults.get(p.userId) ?? null
    });
  }

  // Recordado para que "Jugar de Nuevo" pueda devolver a todo el grupo al
  // mismo lobby (ver lobby:rematch) en vez de que cada uno cree el suyo
  if (!isVersus && active.hostId) {
    finishedLobbyGames.set(gameId, {
      hostId: active.hostId,
      players: players.map((p: any) => ({ userId: p.userId, username: p.username }))
    });
  }
}

// Socket.io for real-time gameplay
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('authenticate', async (token: string) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string; username: string };
      (socket as any).userId = decoded.userId;
      (socket as any).username = decoded.username;

      // Un usuario puede tener varios sockets a la vez (la app principal más
      // una ventana de chat aparte, p.ej.) — solo avisamos "en línea" a sus
      // amigos en la transición real de 0 a 1 sockets, no en cada ventana nueva.
      const wasOnline = isUserOnline(decoded.userId);
      addUserSocket(decoded.userId, socket.id);

      // Update matchmaking queue with socket ID
      if (matchmakingQueue.has(decoded.userId)) {
        const player = matchmakingQueue.get(decoded.userId)!;
        player.socketId = socket.id;
        matchmakingQueue.set(decoded.userId, player);
      }

      // Si tenía una partida en curso (el gameStart se pudo perder mientras no había socket),
      // se le reenvía su estado.
      resyncActiveGame(decoded.userId);

      if (!wasOnline) {
        await notifyFriendsOfPresence(decoded.userId, 'friend:online');
      }
    } catch (error) {
      socket.disconnect();
    }
  });

  // El cliente lo pide si la pantalla VS se pasa de tiempo sin que llegue la partida.
  socket.on('game:resync', () => {
    const userId = (socket as any).userId;
    if (!userId) return;
    resyncActiveGame(userId);
    // Si su emparejamiento ya no existe (se canceló mientras estaba desconectado) y no está en
    // partida ni en cola, su pantalla VS se quedaría colgada: se le avisa para que vuelva a buscar.
    const inGame = [...activeGames.values()].some((g) => g.gameDoc.players.some((p: any) => p.userId === userId));
    if (!inGame && !matchmakingQueue.has(userId) && !pendingMatches.has(userId)) {
      socket.emit('matchCancelled');
    }
  });

  // Palabra enviada en una partida versus: el servidor valida, retransmite a
  // ambos jugadores y es la única fuente de verdad del marcador
  socket.on('submitWord', async (data: { gameId: string; word: string }) => {
    const authSocket = socket as any;
    if (!authSocket.userId) return;

    const active = activeGames.get(data?.gameId);
    if (!active) {
      socket.emit('error', 'Esta partida ya no está activa');
      return;
    }

    const { gameDoc } = active;
    const word = String(data.word || '').toLowerCase().trim();
    // El prefijo y las repeticiones no distinguen acentos: "invierno" cuenta aunque el
    // prefijo sea "ín", y repetir "camion" tras "camión" (o al revés) sigue siendo repetir.
    const wordKey = stripAccents(word);

    if (!word || !wordKey.startsWith(stripAccents(gameDoc.prefix.toLowerCase()))) {
      socket.emit('wordRejected', { message: `La palabra debe empezar con "${gameDoc.prefix}"` });
      return;
    }
    // Cada jugador puede decir todas las palabras que conozca: solo se le rechaza repetir una
    // suya. Que el rival ya la haya dicho no le impide usarla (de eso trata el juego).
    const me = gameDoc.players.find((p: any) => p.userId === authSocket.userId);
    if (!me) {
      socket.emit('error', 'No participas en esta partida');
      return;
    }
    if (me.words.some((w: string) => stripAccents(w) === wordKey)) {
      socket.emit('wordRejected', { message: 'Ya has usado esta palabra' });
      return;
    }

    const isValid = await dictionaryService.validateWord(word);
    if (!isValid) {
      socket.emit('wordRejected', { message: 'Palabra no válida en el diccionario español' });
      return;
    }

    const added = gameDoc.addWord(word, authSocket.userId);
    if (!added) {
      socket.emit('wordRejected', { message: 'Palabra no válida' });
      return;
    }
    await gameDoc.save();

    const player = gameDoc.players.find((p: any) => p.userId === authSocket.userId);
    // A quien la dijo se le confirma con su palabra. Al resto solo se le actualiza el marcador:
    // no se les manda la palabra (ni siquiera de forma que no se vea en pantalla), porque cada
    // uno tiene que pensar las suyas sin ver las del rival.
    const score = player?.score || 0;
    for (const p of gameDoc.players) {
      const payload = p.userId === authSocket.userId ? { word, playerId: authSocket.userId, score } : { playerId: authSocket.userId, score };
      emitToUser(p.userId, 'wordSubmitted', payload);
    }
  });

  // Abandono voluntario de una partida versus o con amigos en curso: cuenta como derrota
  socket.on('forfeitGame', (data: { gameId: string }) => {
    const authSocket = socket as any;
    if (!authSocket.userId || !data?.gameId) return;
    finishGame(data.gameId, 'forfeit', authSocket.userId);
  });

  // ---------- Lobby "Con amigos" ----------

  socket.on('lobby:create', () => {
    const authSocket = socket as any;
    if (!authSocket.userId) return;

    // Un anfitrión solo puede tener un lobby abierto a la vez
    for (const [id, existing] of lobbies) {
      if (existing.hostId === authSocket.userId) closeLobby(id);
    }

    const lobbyId = new mongoose.Types.ObjectId().toString();
    const lobby: LobbyState = {
      lobbyId,
      hostId: authSocket.userId,
      players: [{ userId: authSocket.userId, username: authSocket.username }],
      invited: new Set(),
      inviteeIds: new Set(),
      started: false
    };
    lobbies.set(lobbyId, lobby);
    socket.join(`lobby:${lobbyId}`);
    socket.emit('lobby:update', serializeLobby(lobby));
  });

  socket.on('lobby:invite', async (data: { lobbyId: string; friendUsername: string }) => {
    const authSocket = socket as any;
    if (!authSocket.userId || !data?.lobbyId || !data?.friendUsername) return;

    const lobby = lobbies.get(data.lobbyId);
    if (!lobby || lobby.hostId !== authSocket.userId) {
      socket.emit('lobby:error', 'No tienes permiso para invitar en este lobby');
      return;
    }

    const friend = await User.findOne({ username: data.friendUsername });
    if (!friend) {
      socket.emit('lobby:error', 'Usuario no encontrado');
      return;
    }

    // Solo se puede invitar a amigos reales y confirmados, nunca a cualquier usuario
    const status = await (Friendship as any).getFriendshipStatus(authSocket.userId, friend._id.toString());
    if (status !== 'accepted') {
      socket.emit('lobby:error', 'Solo puedes invitar a amigos');
      return;
    }

    if (!isUserOnline(friend._id.toString())) {
      socket.emit('lobby:error', `${data.friendUsername} no está conectado`);
      return;
    }

    const friendId = friend._id.toString();
    const firstInvite = !lobby.inviteeIds.has(friendId);
    lobby.invited.add(data.friendUsername);
    lobby.inviteeIds.add(friendId);
    emitToUser(friendId, 'lobby:invited', { lobbyId: lobby.lobbyId, hostUsername: authSocket.username });

    // Además del aviso efímero, la invitación queda en el chat: si el amigo
    // no estaba mirando la pantalla, puede aceptarla al volver mientras el
    // lobby siga abierto. Solo una vez por amigo y lobby.
    if (firstInvite) {
      const invite = await (Message as any).create({
        from: authSocket.userId,
        to: friendId,
        text: `${authSocket.username} te invitó a una partida con amigos`,
        kind: 'lobby-invite',
        lobbyId: lobby.lobbyId
      });
      const invitePayload = serializeMessage(invite);
      emitToUser(authSocket.userId, 'dm:message', invitePayload);
      emitToUser(friendId, 'dm:message', invitePayload);
    }
    io.to(`lobby:${lobby.lobbyId}`).emit('lobby:update', serializeLobby(lobby));
  });

  socket.on('lobby:join', (data: { lobbyId: string }) => {
    const authSocket = socket as any;
    if (!authSocket.userId || !data?.lobbyId) return;

    const lobby = lobbies.get(data.lobbyId);
    if (!lobby || lobby.started) {
      socket.emit('lobby:error', 'Este lobby ya no está disponible');
      return;
    }
    if (lobby.players.length >= 15) {
      socket.emit('lobby:error', 'El lobby está lleno');
      return;
    }

    if (!lobby.players.some((p) => p.userId === authSocket.userId)) {
      lobby.players.push({ userId: authSocket.userId, username: authSocket.username });
    }
    socket.join(`lobby:${lobby.lobbyId}`);
    io.to(`lobby:${lobby.lobbyId}`).emit('lobby:update', serializeLobby(lobby));
  });

  socket.on('lobby:leave', (data: { lobbyId: string }) => {
    const authSocket = socket as any;
    if (!authSocket.userId || !data?.lobbyId) return;
    leaveLobby(data.lobbyId, authSocket.userId);
  });

  socket.on('lobby:start', (data: { lobbyId: string }) => {
    const authSocket = socket as any;
    if (!authSocket.userId || !data?.lobbyId) return;

    const lobby = lobbies.get(data.lobbyId);
    if (!lobby || lobby.hostId !== authSocket.userId) {
      socket.emit('lobby:error', 'Solo el anfitrión puede iniciar la partida');
      return;
    }
    if (lobby.players.length < 2) {
      socket.emit('lobby:error', 'Necesitas al menos 2 jugadores para empezar');
      return;
    }

    lobby.started = true;
    closeLobby(lobby.lobbyId);
    startLobbyGame(lobby);
  });

  // Pide volver al mismo grupo tras una partida "con amigos" ya terminada.
  // El primero en pedirlo crea el lobby de revancha; los siguientes se
  // enteran de ese mismo lobbyId en vez de crear cada uno el suyo — así da
  // igual el orden en que cada jugador pulse "Jugar de Nuevo".
  socket.on('lobby:rematch', (data: { gameId: string }) => {
    const authSocket = socket as any;
    if (!authSocket.userId || !data?.gameId) return;

    const finished = finishedLobbyGames.get(data.gameId);
    if (!finished || !finished.players.some((p) => p.userId === authSocket.userId)) {
      socket.emit('lobby:error', 'Esa partida ya no está disponible para revancha');
      return;
    }

    if (!finished.rematchLobbyId || !lobbies.has(finished.rematchLobbyId)) {
      const lobbyId = new mongoose.Types.ObjectId().toString();
      lobbies.set(lobbyId, {
        lobbyId,
        hostId: finished.hostId,
        players: [],
        invited: new Set(),
        inviteeIds: new Set(),
        started: false
      });
      finished.rematchLobbyId = lobbyId;
    }

    socket.emit('lobby:rematch-ready', { lobbyId: finished.rematchLobbyId });
  });

  // Mensaje directo a un amigo: se persiste siempre (ver /api/messages arriba)
  // y además se retransmite en vivo a quien lo manda (para que aparezca en su
  // propio hilo con el id/fecha reales) y al destinatario si está conectado.
  socket.on('dm:send', async (data: { to: string; text: string }) => {
    const authSocket = socket as any;
    if (!authSocket.userId || !data?.to) return;

    const text = String(data.text || '').trim().slice(0, 1000);
    if (!text) return;

    const status = await (Friendship as any).getFriendshipStatus(authSocket.userId, data.to);
    if (status !== 'accepted') {
      socket.emit('error', 'Solo puedes escribir a tus amigos');
      return;
    }

    const message = await (Message as any).create({ from: authSocket.userId, to: data.to, text });
    const payload = serializeMessage(message);

    socket.emit('dm:message', payload);
    emitToUser(data.to, 'dm:message', payload);
  });

  socket.on('disconnect', async () => {
    const authSocket = socket as any;
    if (!authSocket.userId) return;

    // Si el usuario tiene otro socket vivo (p.ej. la app principal sigue
    // abierta mientras se cierra solo una ventana de chat), no está
    // realmente desconectado — no forfeitear partidas ni avisar "offline".
    const fullyOffline = removeUserSocket(authSocket.userId, socket.id);
    if (!fullyOffline) return;

    matchmakingQueue.delete(authSocket.userId);

    // Las partidas en curso no se pierden al instante: ver DISCONNECT_GRACE_MS.
    for (const [gameId, active] of activeGames) {
      if (active.gameDoc.players.some((p: any) => p.userId === authSocket.userId)) {
        forfeitIfStillOffline(gameId, authSocket.userId);
      }
    }

    for (const lobbyId of Array.from(lobbies.keys())) {
      leaveLobby(lobbyId, authSocket.userId);
    }

    await notifyFriendsOfPresence(authSocket.userId, 'friend:offline');
  });
});

// Avisa en vivo a los amigos ya conectados de que este usuario acaba de
// conectarse/desconectarse, para que su estado "En línea" se actualice sin
// que tengan que recargar la página — antes solo se calculaba una vez, al
// cargar /api/friends, y quedaba obsoleto en cuanto alguien se conectaba después.
async function notifyFriendsOfPresence(userId: string, event: 'friend:online' | 'friend:offline'): Promise<void> {
  const friends = await Friendship.getFriends(userId);
  for (const friend of friends) {
    emitToUser(friend.id.toString(), event, { userId });
  }
}

// Cierra un lobby (arrancó, se disolvió o lo reemplazó otro) y avisa a quienes
// fueron invitados para que la invitación de su chat deje de ser aceptable.
function closeLobby(lobbyId: string): void {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) return;
  lobbies.delete(lobbyId);
  for (const inviteeId of lobby.inviteeIds) {
    emitToUser(inviteeId, 'lobby:closed', { lobbyId });
  }
}

// Forma en que un mensaje viaja al cliente (historial y en vivo). Una
// invitación lleva además si su lobby sigue abierto en este momento.
function serializeMessage(m: any) {
  const isInvite = m.kind === 'lobby-invite';
  return {
    id: m._id.toString(),
    from: m.from,
    to: m.to,
    text: m.text,
    createdAt: m.createdAt,
    kind: m.kind || 'text',
    ...(isInvite ? { lobbyId: m.lobbyId, lobbyActive: lobbies.has(m.lobbyId) } : {})
  };
}

// Saca a un jugador de un lobby: si era el anfitrión, el lobby se disuelve
// para todos; si era un invitado, simplemente se actualiza la lista en vivo.
function leaveLobby(lobbyId: string, userId: string): void {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || !lobby.players.some((p) => p.userId === userId)) return;

  if (lobby.hostId === userId) {
    closeLobby(lobbyId);
    io.to(`lobby:${lobbyId}`).emit('lobby:disbanded');
  } else {
    lobby.players = lobby.players.filter((p) => p.userId !== userId);
    io.to(`lobby:${lobbyId}`).emit('lobby:update', serializeLobby(lobby));
  }
}

// El rango de ELO aceptable empieza estrecho (partidas parejas) y se ensancha
// cuanto más lleva alguien esperando. Con pocos jugadores conectados, esperar
// un rival "justo" es peor que jugar una partida desigual, así que pasado
// MATCHMAKING_ANY_OPPONENT_MS se acepta a cualquiera: la espera máxima queda
// acotada en vez de crecer con la diferencia de ELO.
const MATCHMAKING_INITIAL_RANGE = 100;
const MATCHMAKING_RANGE_STEP = 100;
const MATCHMAKING_STEP_MS = 3000;
const MATCHMAKING_ANY_OPPONENT_MS = 15000;

function matchmakingRange(player: MatchmakingPlayer): number {
  const waited = Date.now() - player.queuedAt;
  if (waited >= MATCHMAKING_ANY_OPPONENT_MS) return Infinity;
  return MATCHMAKING_INITIAL_RANGE + Math.floor(waited / MATCHMAKING_STEP_MS) * MATCHMAKING_RANGE_STEP;
}

// Matchmaking logic
setInterval(() => {
  // Solo se empareja a quien tiene un socket conectado ahora mismo (así los dos reciben
  // matchFound y gameStart). Quien lleva demasiado sin conexión se saca de la cola.
  const now = Date.now();
  for (const [userId, queued] of matchmakingQueue) {
    if (isUserOnline(userId)) {
      queued.lastSeen = now;
    } else if (now - (queued.lastSeen ?? queued.queuedAt) > MATCHMAKING_STALE_MS) {
      matchmakingQueue.delete(userId);
    }
  }

  // Ordenados por ELO: los rivales más parecidos quedan adyacentes, así el
  // bucle encuentra primero los emparejamientos más justos antes que los amplios
  const players = Array.from(matchmakingQueue.values())
    .filter((p) => isUserOnline(p.userId))
    .sort((a, b) => a.elo - b.elo);

  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const player1 = players[i];
      const player2 = players[j];

      // Un jugador ya emparejado en una vuelta anterior de este mismo tick
      // sigue en el snapshot `players` aunque ya no esté en la cola real
      if (!matchmakingQueue.has(player1.userId) || !matchmakingQueue.has(player2.userId)) {
        continue;
      }

      // Rango aceptado: el más generoso de los dos, para que quien lleva más
      // tiempo esperando no se quede bloqueado por el umbral, aún estrecho, del otro
      const allowedRange = Math.max(matchmakingRange(player1), matchmakingRange(player2));
      if (Math.abs(player1.elo - player2.elo) <= allowedRange) {
        // Create match
        const gameId = new mongoose.Types.ObjectId().toString();

        // Remove from queue
        matchmakingQueue.delete(player1.userId);
        matchmakingQueue.delete(player2.userId);

        // Notify players — se prefiere el/los socket(s) vivos en userSockets;
        // el socketId guardado en la cola es solo el respaldo para la carrera
        // en la que el socket se autentica antes de que el POST
        // /matchmaking/join termine de guardarlo
        const notifyMatchFound = (player: MatchmakingPlayer, rival: MatchmakingPlayer) => {
          const payload = {
            gameId,
            opponent: rival.username,
            me: { username: player.username, avatar: player.avatar, elo: player.elo },
            rival: { username: rival.username, avatar: rival.avatar, elo: rival.elo },
            // Lo que cada uno ganaría/perdería, para la pantalla VS
            eloIfWin: eloChangeFor(player.elo, rival.elo, true),
            eloIfLose: eloChangeFor(player.elo, rival.elo, false)
          };
          if (isUserOnline(player.userId)) {
            emitToUser(player.userId, 'matchFound', payload);
          } else if (player.socketId) {
            io.to(player.socketId).emit('matchFound', payload);
          }
        };
        notifyMatchFound(player1, player2);
        notifyMatchFound(player2, player1);

        // Pausa antes de arrancar para que se vea la pantalla VS. Al acabar se comprueba que el
        // emparejamiento sigue en pie y que los dos siguen conectados: si no, se cancela y quien
        // sí está vuelve a la cola, en vez de arrancar una partida contra alguien que no está
        // (que acabaría en abandono y daría ELO gratis al otro).
        const pending: PendingMatch = { gameId, players: [player1, player2], cancelled: false };
        pendingMatches.set(player1.userId, pending);
        pendingMatches.set(player2.userId, pending);

        setTimeout(async () => {
          for (const p of pending.players) {
            if (pendingMatches.get(p.userId) === pending) pendingMatches.delete(p.userId);
          }
          if (pending.cancelled) return;

          if (!isUserOnline(player1.userId) || !isUserOnline(player2.userId)) {
            pending.cancelled = true;
            pending.players.forEach(requeueAndNotify);
            return;
          }
          try {
            await startVersusGame(gameId, player1, player2);
          } catch (error) {
            console.error('Error arrancando la partida versus:', error);
            pending.cancelled = true;
            pending.players.forEach(requeueAndNotify);
          }
        }, VERSUS_INTRO_MS);

        break;
      }
    }
  }
}, 2000); // Check every 2 seconds

// Web de Angular compilada: en producción este mismo servidor la sirve, así que
// el cliente y la API comparten origen y las rutas relativas (/api, /socket.io)
// funcionan sin configurar URLs ni CORS. En desarrollo no existe la carpeta
// (el cliente corre con ng serve y su proxy), y esto simplemente no se activa.
// Va después de todas las rutas de la API para no taparlas.
const CLIENT_DIST = path.join(__dirname, '..', 'client-angular', 'dist', 'client-angular', 'browser');
const CLIENT_BUILT = fs.existsSync(path.join(CLIENT_DIST, 'index.html'));

// Páginas públicas que Angular prerenderiza al compilar (ver app.routes.server.ts):
// son las que entran en el sitemap y las que se sirven ya con su contenido en el HTML.
const PUBLIC_PAGES = ['/', '/legal/privacidad', '/legal/terminos', '/legal/aviso-legal', '/legal/cookies', '/contacto'];

// Rutas que existen en el cliente (app.routes.ts). Cualquier otra ruta responde 404
// de verdad, en vez de un 200 con la pantalla de "no encontrada" (un "soft 404" que
// los buscadores penalizan). Hay que mantenerla en sincronía con las rutas del cliente.
const CLIENT_ROUTES: RegExp[] = [
  /^\/auth(\/(register|forgot-password|reset-password|check-email|verify-email))?$/,
  /^\/(menu|profile|daily-challenge|gracias|contacto|lobby)$/,
  /^\/lobby\/[^/]+$/,
  /^\/profile\/[^/]+$/,
  /^\/play\/(matchmaking|game|results)$/,
  /^\/play\/setup\/[^/]+$/,
  /^\/legal\/(privacidad|terminos|aviso-legal|cookies)$/
];

// Rutas privadas o sin valor para un buscador: se piden fuera del rastreo.
const ROBOTS_DISALLOW = ['/api/', '/auth', '/menu', '/play/', '/lobby', '/daily-challenge', '/profile', '/gracias'];

if (CLIENT_BUILT) {
  const CSR_SHELL = fs.existsSync(path.join(CLIENT_DIST, 'index.csr.html')) ? 'index.csr.html' : 'index.html';

  // Dominio público, para las URLs absolutas de canonical / Open Graph / sitemap.
  // En producción manda CLIENT_URL; si no, el host de la propia petición.
  const siteUrl = (req: express.Request): string =>
    ((process.env.NODE_ENV === 'production' && process.env.CLIENT_URL) || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');

  // El HTML compilado lleva __SITE_URL__ donde va el dominio; se lee una vez y se
  // sustituye en cada respuesta.
  // Hashes SHA-256 de los scripts y manejadores en línea de una página (el
  // bootstrap de los eventos y el `onload` con que se carga la hoja de estilos):
  // la CSP los admite por su contenido exacto, sin abrir la puerta a `'unsafe-inline'`.
  const hashOf = (text: string): string => `'sha256-${crypto.createHash('sha256').update(text).digest('base64')}'`;
  const inlineHashes = (html: string): { scripts: string[]; handlers: string[] } => {
    const scripts = new Set<string>();
    const handlers = new Set<string>();
    // Los bloques application/json y ld+json son datos: la CSP no los ejecuta ni los restringe.
    const scriptRe = /<script(?![^>]*\bsrc=)(?![^>]*type="application\/(?:ld\+)?json")[^>]*>([\s\S]*?)<\/script>/gi;
    for (let m = scriptRe.exec(html); m; m = scriptRe.exec(html)) scripts.add(hashOf(m[1]));
    const handlerRe = /\son[a-z]+="([^"]*)"/gi;
    for (let m = handlerRe.exec(html); m; m = handlerRe.exec(html)) handlers.add(hashOf(m[1]));
    return { scripts: [...scripts], handlers: [...handlers] };
  };

  interface CachedPage { html: string; scriptHashes: string[]; handlerHashes: string[] }
  const pageCache = new Map<string, CachedPage>();
  const sendPage = (req: express.Request, res: express.Response, file: string, status = 200): void => {
    let page = pageCache.get(file);
    if (!page) {
      const html = fs.readFileSync(path.join(CLIENT_DIST, file), 'utf8');
      const hashes = inlineHashes(html);
      page = { html, scriptHashes: hashes.scripts, handlerHashes: hashes.handlers };
      pageCache.set(file, page);
    }
    const host = req.get('host');
    const csp = [
      "default-src 'self'",
      // Analítica opcional (solo se carga con consentimiento, ver cookie-consent.ts).
      `script-src 'self' ${page.scriptHashes.join(' ')} https://www.googletagmanager.com`,
      `script-src-attr ${page.handlerHashes.length ? "'unsafe-hashes' " + page.handlerHashes.join(' ') : "'none'"}`,
      // Angular inserta los estilos de cada componente como <style> en línea.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com",
      // El socket va por el mismo host; se nombra ws/wss explícitamente porque no todos
      // los navegadores lo cubren con 'self'.
      `connect-src 'self' ws://${host} wss://${host} https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com`,
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ');
    res
      .status(status)
      .set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', 'Content-Security-Policy': csp })
      .send(page.html.split('__SITE_URL__').join(siteUrl(req)));
  };

  const prerendered = new Map<string, string>();
  for (const page of PUBLIC_PAGES) {
    const file = page === '/' ? 'index.html' : `${page.slice(1)}/index.html`;
    if (fs.existsSync(path.join(CLIENT_DIST, file))) prerendered.set(page, file);
  }

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(
      ['User-agent: *', 'Allow: /', ...ROBOTS_DISALLOW.map((p) => `Disallow: ${p}`), '', `Sitemap: ${siteUrl(req)}/sitemap.xml`, ''].join('\n')
    );
  });

  app.get('/sitemap.xml', (req, res) => {
    const base = siteUrl(req);
    const urls = PUBLIC_PAGES.map((p) => `  <url><loc>${base}${p}</loc></url>`).join('\n');
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
    );
  });

  // Los .html crudos (con el marcador sin sustituir) no se sirven nunca directamente.
  app.get(/\.html$/, (req, res) => sendPage(req, res, CSR_SHELL, 404));

  app.use(
    express.static(CLIENT_DIST, {
      index: false,
      redirect: false,
      // Angular nombra los js/css con un hash de contenido: si cambian, cambia el
      // nombre, así que pueden cachearse para siempre. El resto (imágenes) se
      // revalida para que un despliegue nuevo se vea al momento.
      setHeaders: (res, filePath) => {
        if (/-[A-Za-z0-9_-]{8}\.(js|css)$/.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      }
    })
  );

  // Páginas de la web: las públicas ya prerenderizadas, las privadas con el cascarón
  // que se renderiza en el navegador, y 404 real para lo que no existe. La API y el
  // socket quedan fuera.
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
      next();
      return;
    }
    const route = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
    const page = prerendered.get(route);
    if (page) {
      sendPage(req, res, page);
    } else if (CLIENT_ROUTES.some((pattern) => pattern.test(route))) {
      sendPage(req, res, CSR_SHELL);
    } else {
      sendPage(req, res, CSR_SHELL, 404);
    }
  });
}

// Start server
const PORT = process.env.PORT || 3000;

// Cuentas creadas antes de la verificación de email: se dan por verificadas y reciben su
// clave normalizada (los campos nuevos no existen en sus documentos). Es idempotente.
const migrateUsers = async (): Promise<void> => {
  try {
    const verified = await User.collection.updateMany({ emailVerified: { $exists: false } }, { $set: { emailVerified: true } });
    const withoutKey = await User.collection.find({ emailKey: { $exists: false } }, { projection: { email: 1 } }).toArray();
    let keyed = 0;
    for (const doc of withoutKey) {
      try {
        await User.collection.updateOne({ _id: doc._id }, { $set: { emailKey: normalizeEmail(String(doc.email)) } });
        keyed++;
      } catch {
        console.warn(`⚠️  Dos cuentas comparten bandeja tras normalizar (${doc.email}); se deja sin clave`);
      }
    }
    if (verified.modifiedCount || keyed) {
      console.log(`👤 Cuentas migradas: ${verified.modifiedCount} marcadas como verificadas, ${keyed} con clave de email`);
    }
  } catch (error) {
    console.error('Error migrando cuentas:', error);
  }
};

const startServer = async (): Promise<void> => {
  await connectDB();
  await migrateUsers();
  warnAboutEmailConfig();
  console.log(
    emailVerificationRequired()
      ? '✉️  Verificación de email: activada'
      : '⚠️  RESEND_API_KEY no configurada: en producción no se exige verificar el email'
  );

  server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(CLIENT_BUILT
      ? `📱 Cliente disponible en http://localhost:${PORT}`
      : '📱 Sin cliente compilado: en desarrollo usa "npm run dev:client"');
  });
};

startServer().catch(console.error);
