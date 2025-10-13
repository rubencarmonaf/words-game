import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

// Import models
import User from './models/User';
import Game from './models/Game';
import Friendship from './models/Friendship';

// Import services
import { dictionaryService } from './utils/dictionary';

// Import types
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  AuthResponse, 
  WordValidationResponse,
  MatchmakingPlayer,
  AuthenticatedSocket,
  SocketEvents
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

    // Create user
    const user = new User({
      username,
      email,
      password, // Will be hashed by pre-save middleware
      elo: 1200,
      gamesPlayed: 0,
      gamesWon: 0
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
      user: {
        id: user._id.toString(),
        username: user.username,
        elo: user.elo,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        winRate: user.winRate
      }
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
      user: {
        id: user._id.toString(),
        username: user.username,
        elo: user.elo,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        winRate: user.winRate
      }
    };

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('Error en login:', error);
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
    
    res.json({ 
      success: true, 
      data: {
        id: user._id.toString(),
        username: user.username,
        elo: user.elo,
        gamesPlayed: user.gamesPlayed,
        gamesWon: user.gamesWon,
        winRate: user.winRate
      }
    });
  } catch (error) {
    console.error('Error obteniendo perfil:', error);
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
