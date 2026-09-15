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
  DailyChallengeResponse
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
    const { username, avatarColor, avatarIcon } = req.body;
    const validColors = ['cobalt', 'scarlet', 'amber', 'lime'];
    const validIcons = ['target', 'link', 'bolt', 'users', 'flame', 'star'];

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

    if (avatarColor !== undefined) {
      if (!validColors.includes(avatarColor)) {
        res.status(400).json({ success: false, message: 'Color de avatar no válido' });
        return;
      }
      user.avatarColor = avatarColor;
    }

    if (avatarIcon !== undefined) {
      if (!validIcons.includes(avatarIcon)) {
        res.status(400).json({ success: false, message: 'Icono de avatar no válido' });
        return;
      }
      user.avatarIcon = avatarIcon;
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
    res.json({ success: true, data: friends });
  } catch (error) {
    console.error('Error obteniendo amigos:', error);
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
      socketId: undefined
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

// Socket.io for real-time gameplay
io.on('connection', (socket) => {
  console.log('Usuario conectado:', socket.id);

  socket.on('authenticate', (token: string) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as { userId: string; username: string };
      (socket as any).userId = decoded.userId;
      (socket as any).username = decoded.username;
      
      // Update matchmaking queue with socket ID
      if (matchmakingQueue.has(decoded.userId)) {
        const player = matchmakingQueue.get(decoded.userId)!;
        player.socketId = socket.id;
        matchmakingQueue.set(decoded.userId, player);
      }
    } catch (error) {
      socket.disconnect();
    }
  });

  socket.on('disconnect', () => {
    const authSocket = socket as any;
    if (authSocket.userId) {
      matchmakingQueue.delete(authSocket.userId);
    }
  });
});

// Matchmaking logic
setInterval(() => {
  const players = Array.from(matchmakingQueue.values());
  
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const player1 = players[i];
      const player2 = players[j];
      
      // Check if ELO difference is acceptable (within 200 points)
      if (Math.abs(player1.elo - player2.elo) <= 200) {
        // Create match
        const gameId = new mongoose.Types.ObjectId().toString();
        
        // Remove from queue
        matchmakingQueue.delete(player1.userId);
        matchmakingQueue.delete(player2.userId);
        
        // Notify players
        if (player1.socketId) {
          io.to(player1.socketId).emit('matchFound', { gameId, opponent: player2.username });
        }
        if (player2.socketId) {
          io.to(player2.socketId).emit('matchFound', { gameId, opponent: player1.username });
        }
        
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
