# ⚔️ WordWars

Un juego de palabras competitivo online con sistema de ranking ELO, desarrollado en TypeScript con Node.js.

## 🚀 Características

- **Validación de palabras**: Solo acepta palabras válidas del diccionario español
- **Sistema de ranking ELO**: Clasificación competitiva de jugadores
- **Partidas online**: Juega contra otros jugadores en tiempo real
- **Sistema de amigos**: Agrega amigos y juega partidas amistosas
- **Múltiples modos de juego**:
  - 🏃 **Solo**: Práctica sin límite de tiempo
  - ⚔️ **Versus Online**: Compite contra otros jugadores
  - 👥 **Amigos**: Juega con tus amigos (sin afectar ELO)

## 🛠️ Tecnologías

### Backend
- **Node.js** con **TypeScript**
- **Express.js** para API REST
- **Socket.io** para comunicación en tiempo real
- **MongoDB** con **Mongoose** para base de datos
- **JWT** para autenticación
- **bcryptjs** para hash de contraseñas

### Frontend
- **Angular** (standalone components, Signals, zoneless) en `client-angular/`
- **SCSS** por componente, con tokens de diseño compartidos
- **Socket.io Client** para comunicación en tiempo real
- **DiceBear** para los avatares ilustrados

## 📦 Instalación

### Prerrequisitos
- Node.js 18+ 
- MongoDB
- npm o yarn

### Pasos

1. **Clonar el repositorio**
```bash
git clone <repository-url>
cd words-game
```

2. **Instalar dependencias**
```bash
npm install
```

3. **Configurar variables de entorno**
```bash
cp env.example .env
# Editar .env con tus configuraciones
```

4. **Iniciar MongoDB**
```bash
# En Windows
net start MongoDB

# En macOS/Linux
sudo systemctl start mongod
```

5. **Inicio rápido (recomendado)**
```bash
# Windows
start-dev.bat

# Linux/macOS
./start-dev.sh
```

6. **O manualmente**
```bash
# Terminal 1: Backend
npm run dev

# Terminal 2: Frontend
npm run dev:client
```

## 🎮 Uso

### Desarrollo

#### Opción 1: Scripts automáticos
```bash
# Windows
start-dev.bat

# Linux/macOS
./start-dev.sh
```

#### Opción 2: Manual
```bash
# Terminal 1: Servidor backend
npm run dev

# Terminal 2: Cliente frontend
npm run dev:client
```

### Producción
```bash
# Compilar todo
npm run build
npm run build:client

# Iniciar servidor
npm start
```

## 🏗️ Arquitectura

### Backend Structure
```
src/
├── models/          # Modelos de MongoDB
│   ├── User.ts
│   ├── Game.ts
│   └── Friendship.ts
├── types/           # Definiciones TypeScript
│   └── index.ts
├── utils/           # Utilidades
│   └── dictionary.ts
└── server.ts        # Servidor principal
```

### Frontend Structure
```
client-angular/
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── services/       # Auth, Game, Socket, Profile, DailyChallenge...
│   │   │   ├── guards/         # authGuard, guestGuard, resetRedirectGuard
│   │   │   └── models/         # eloTier() y demás modelos de cliente
│   │   ├── features/           # Una carpeta/archivo por pantalla enrutada
│   │   ├── shared/
│   │   │   ├── components/     # ww-avatar, toast-host, site-footer...
│   │   │   └── services/       # Toast, CookieConsent
│   │   ├── app.routes.ts
│   │   └── app.config.ts
│   └── styles/                # Tokens, reset, forms, buttons (vocabulario global)
└── proxy.conf.json            # /api y /socket.io → http://localhost:3000
```

## 🔧 API Endpoints

### Autenticación
- `POST /api/register` - Registro de usuario
- `POST /api/login` - Inicio de sesión
- `GET /api/profile` - Obtener perfil del usuario

### Juego
- `POST /api/validate-word` - Validar palabra
- `POST /api/matchmaking/join` - Unirse a matchmaking
- `POST /api/matchmaking/leave` - Salir de matchmaking

### Amigos
- `GET /api/friends` - Obtener lista de amigos
- `POST /api/friends/request` - Enviar solicitud de amistad

## 🎯 Modos de Juego

### Solo
- Tiempo ilimitado
- Práctica sin presión
- No afecta el ranking

### Versus Online
- Partidas de 5 minutos
- Matchmaking automático por ELO
- Afecta el ranking ELO
- Palabras no repetibles

### Amigos
- Partidas privadas
- No afecta el ranking
- Ideal para práctica

## 🏆 Sistema ELO

- **ELO inicial**: 1200 puntos
- **Factor K**: 32 (ajustable)
- **Rango de matchmaking**: ±200 puntos ELO
- **Cálculo**: Fórmula estándar ELO

## 🔒 Seguridad

- Contraseñas hasheadas con bcrypt
- JWT para autenticación
- Validación de entrada
- CORS configurado
- Rate limiting (próximamente)

## 🚀 Despliegue

### Docker (próximamente)
```bash
docker-compose up -d
```

### Variables de entorno para producción
```env
MONGODB_URI=mongodb://your-production-db
JWT_SECRET=your-super-secure-secret
PORT=3000
NODE_ENV=production
```

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 🎮 Próximas Características

- [ ] Sistema de torneos
- [ ] Chat en tiempo real
- [ ] Logros y badges
- [ ] Estadísticas avanzadas
- [ ] Modo multijugador (más de 2 jugadores)
- [ ] Diferentes idiomas
- [ ] App móvil (React Native)

## 🐛 Reportar Bugs

Si encuentras un bug, por favor crea un issue con:
- Descripción del problema
- Pasos para reproducir
- Screenshots si es necesario
- Información del sistema

## 📞 Contacto

- **Desarrollador**: Ruben
- **Email**: [tu-email@ejemplo.com]
- **GitHub**: [tu-github]

---

¡Disfruta jugando! 🎯✨
