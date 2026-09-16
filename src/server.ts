import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Import models
import User from './models/User';
import Game from './models/Game';
import Friendship from './models/Friendship';
import DailyChallenge from './models/DailyChallenge';
import DailyChallengeCompletion from './models/DailyChallengeCompletion';
import Message from './models/Message';

// Import services
import { dictionaryService } from './utils/dictionary';
import { sendPasswordResetEmail } from './utils/email';

// Import types
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  AuthResponse, 
  WordValidationResponse,
  MatchmakingPlayer,
  AuthenticatedSocket,
  SocketEvents,
  DailyChallengeResponse,
  sanitizeAvatarOptions
} from './types';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(express.json());

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

// Auth routes
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // Validation
    if (!username || !email || !password) {
      res.status(400).json({ success: false, message: 'Todos los campos son requeridos' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }
    
    // Check if user exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      res.status(400).json({ success: false, message: 'Usuario ya existe' });
      return;
    }

    // Create user (elo/gamesPlayed/gamesWon start at the schema defaults)
    const user = new User({
      username,
      email,
      password // Will be hashed by pre-save middleware
    });

    await user.save();
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const response: AuthResponse = {
      token,
      user: user.toPublicJSON()
    };

    res.status(201).json({ success: true, data: response });
  } catch (error) {
    console.error('Error en registro:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email y contraseña requeridos' });
      return;
    }
    
    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ success: false, message: 'Credenciales inválidas' });
      return;
    }

    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      res.status(400).json({ success: false, message: 'Credenciales inválidas' });
      return;
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    const response: AuthResponse = {
      token,
      user: user.toPublicJSON()
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

// Solicitar reseteo de contraseña: genera token, lo guarda hasheado y envía el email
app.post('/api/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ success: false, message: 'Email requerido' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

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
    const hashedToken = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const resetUrl = `${clientUrl}/?reset=${rawToken}`;

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

// Confirmar reseteo: valida el token y establece la nueva contraseña
app.post('/api/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      res.status(400).json({ success: false, message: 'Token y contraseña requeridos' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres' });
      return;
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      res.status(400).json({ success: false, message: 'El enlace no es válido o ha caducado. Solicita uno nuevo.' });
      return;
    }

    user.password = password; // el hook pre-save lo hashea
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
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
    await friendship.save();

    res.json({ success: true, message: accept ? 'Solicitud aceptada' : 'Solicitud rechazada' });
  } catch (error) {
    console.error('Error respondiendo solicitud de amistad:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

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

    if (existingFriendship) {
      res.status(400).json({ success: false, message: 'Solicitud ya enviada o ya son amigos' });
      return;
    }

    const friendship = new (Friendship as any)({
      requester: req.user.userId,
      addressee: friend._id.toString(),
      status: 'pending'
    });

    await friendship.save();
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
    const counts = await (Message as any).aggregate([
      { $match: { to: req.user.userId, read: false } },
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
      data: messages.map((m: any) => ({
        id: m._id.toString(),
        from: m.from,
        to: m.to,
        text: m.text,
        createdAt: m.createdAt
      }))
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

app.post('/api/matchmaking/join', authenticateToken, async (req: any, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      res.status(404).json({ success: false, message: 'Usuario no encontrado' });
      return;
    }
    
    // Add to matchmaking queue
    matchmakingQueue.set(req.user.userId, {
      userId: req.user.userId,
      username: user.username,
      elo: user.elo,
      socketId: undefined,
      queuedAt: Date.now()
    });

    res.json({ success: true, message: 'Buscando partida...' });
  } catch (error) {
    console.error('Error uniéndose a matchmaking:', error);
    res.status(500).json({ success: false, message: 'Error del servidor' });
  }
});

app.post('/api/matchmaking/leave', authenticateToken, (req: any, res) => {
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
        // Check if word starts with the required prefix
        if (upperWord.startsWith(challenge.prefix)) {
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
const VERSUS_DURATION_MS = 5 * 60 * 1000;
// "Con amigos" es casual (no afecta ELO) y N-jugador, así que se juega a un
// ritmo más corto que el 1v1 rankeado — coherente con el resto del catálogo casual.
const LOBBY_DURATION_MS = 2 * 60 * 1000;

// Partidas versus/amigos en curso: el documento Game vive en memoria durante la partida
// y se persiste en cada palabra/al terminar, evitando una relectura por jugada.
// hostId solo se rellena para partidas "con amigos" (versus no tiene anfitrión).
const activeGames = new Map<string, { gameDoc: any; timer: NodeJS.Timeout; hostId?: string }>();

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
  activeGames.set(gameId, { gameDoc, timer });

  const startPayload = {
    gameId,
    prefix,
    players: [
      { userId: player1.userId, username: player1.username },
      { userId: player2.userId, username: player2.username }
    ]
  };

  emitToUser(player1.userId, 'gameStart', startPayload);
  emitToUser(player2.userId, 'gameStart', startPayload);
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
  activeGames.set(gameId, { gameDoc, timer, hostId: lobby.hostId });

  const startPayload = {
    gameId,
    prefix,
    players: lobby.players.map((p) => ({ userId: p.userId, username: p.username }))
  };

  for (const p of lobby.players) emitToUser(p.userId, 'gameStart', startPayload);
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

  // El ELO solo existe en versus (1v1 rankeado); "con amigos" nunca lo toca
  if (winnerId && isVersus) {
    const loser = players.find((p: any) => p.userId !== winnerId);
    const winnerUser = await User.findById(winnerId);
    const loserUser = loser ? await User.findById(loser.userId) : null;
    if (winnerUser && loserUser) {
      const winnerEloBefore = winnerUser.elo;
      const loserEloBefore = loserUser.elo;
      winnerUser.updateElo(loserEloBefore, true);
      loserUser.updateElo(winnerEloBefore, false);
      await winnerUser.save();
      await loserUser.save();
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
      won: winnerId === p.userId
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

      if (!wasOnline) {
        await notifyFriendsOfPresence(decoded.userId, 'friend:online');
      }
    } catch (error) {
      socket.disconnect();
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

    if (!word || !word.startsWith(gameDoc.prefix.toLowerCase())) {
      socket.emit('wordRejected', { message: `La palabra debe empezar con "${gameDoc.prefix}"` });
      return;
    }
    if (gameDoc.allWords.includes(word)) {
      socket.emit('wordRejected', { message: 'Ya se ha usado esta palabra' });
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
    const payload = { word, playerId: authSocket.userId, score: player?.score || 0 };
    for (const p of gameDoc.players) emitToUser(p.userId, 'wordSubmitted', payload);
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
      if (existing.hostId === authSocket.userId) lobbies.delete(id);
    }

    const lobbyId = new mongoose.Types.ObjectId().toString();
    const lobby: LobbyState = {
      lobbyId,
      hostId: authSocket.userId,
      players: [{ userId: authSocket.userId, username: authSocket.username }],
      invited: new Set(),
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

    lobby.invited.add(data.friendUsername);
    emitToUser(friend._id.toString(), 'lobby:invited', { lobbyId: lobby.lobbyId, hostUsername: authSocket.username });
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
    lobbies.delete(lobby.lobbyId);
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
    const payload = {
      id: message._id.toString(),
      from: message.from,
      to: message.to,
      text: message.text,
      createdAt: message.createdAt
    };

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

    for (const [gameId, active] of activeGames) {
      if (active.gameDoc.players.some((p: any) => p.userId === authSocket.userId)) {
        finishGame(gameId, 'forfeit', authSocket.userId);
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

// Saca a un jugador de un lobby: si era el anfitrión, el lobby se disuelve
// para todos; si era un invitado, simplemente se actualiza la lista en vivo.
function leaveLobby(lobbyId: string, userId: string): void {
  const lobby = lobbies.get(lobbyId);
  if (!lobby || !lobby.players.some((p) => p.userId === userId)) return;

  if (lobby.hostId === userId) {
    lobbies.delete(lobbyId);
    io.to(`lobby:${lobbyId}`).emit('lobby:disbanded');
  } else {
    lobby.players = lobby.players.filter((p) => p.userId !== userId);
    io.to(`lobby:${lobbyId}`).emit('lobby:update', serializeLobby(lobby));
  }
}

// El rango de ELO aceptable empieza estrecho (partidas parejas) y se ensancha
// cuanto más lleva alguien esperando, para no dejar a nadie en cola para siempre
// si no hay rivales cercanos.
const MATCHMAKING_INITIAL_RANGE = 100;
const MATCHMAKING_RANGE_STEP = 50;
const MATCHMAKING_STEP_MS = 5000;

function matchmakingRange(player: MatchmakingPlayer): number {
  const waited = Date.now() - player.queuedAt;
  return MATCHMAKING_INITIAL_RANGE + Math.floor(waited / MATCHMAKING_STEP_MS) * MATCHMAKING_RANGE_STEP;
}

// Matchmaking logic
setInterval(() => {
  // Ordenados por ELO: los rivales más parecidos quedan adyacentes, así el
  // bucle encuentra primero los emparejamientos más justos antes que los amplios
  const players = Array.from(matchmakingQueue.values()).sort((a, b) => a.elo - b.elo);

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
        if (isUserOnline(player1.userId)) {
          emitToUser(player1.userId, 'matchFound', { gameId, opponent: player2.username });
        } else if (player1.socketId) {
          io.to(player1.socketId).emit('matchFound', { gameId, opponent: player2.username });
        }
        if (isUserOnline(player2.userId)) {
          emitToUser(player2.userId, 'matchFound', { gameId, opponent: player1.username });
        } else if (player2.socketId) {
          io.to(player2.socketId).emit('matchFound', { gameId, opponent: player1.username });
        }

        // Pequeña pausa antes de arrancar la partida para que se vea el aviso de emparejamiento
        setTimeout(() => { startVersusGame(gameId, player1, player2); }, 1500);

        break;
      }
    }
  }
}, 2000); // Check every 2 seconds

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async (): Promise<void> => {
  await connectDB();
  
  server.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📱 Cliente disponible en http://localhost:3001`);
  });
};

startServer().catch(console.error);
