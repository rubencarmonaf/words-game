import { io, Socket } from 'socket.io-client';

export interface SocketEvents {
    authenticate: (token: string) => void;
    matchFound: (data: { gameId: string; opponent: string }) => void;
    gameStart: (data: { gameId: string; prefix: string; players: any[] }) => void;
    wordSubmitted: (data: { word: string; playerId: string; score: number }) => void;
    gameEnd: (data: { winner: string; finalScores: any[] }) => void;
    error: (message: string) => void;
}

export class SocketManager {
    private socket: Socket | null = null;
    private token: string | null = null;
    private eventHandlers: Map<string, Function[]> = new Map();

    constructor() {
        this.token = localStorage.getItem('authToken');
    }

    connect(): void {
        if (this.socket?.connected) return;

        const serverURL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
        this.socket = io(serverURL, {
            autoConnect: true,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        this.setupEventListeners();
        
        if (this.token) {
            this.authenticate(this.token);
        }
    }

    disconnect(): void {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    authenticate(token: string): void {
        this.token = token;
        if (this.socket) {
            this.socket.emit('authenticate', token);
        }
    }

    private setupEventListeners(): void {
        if (!this.socket) return;

        this.socket.on('connect', () => {
            console.log('Socket conectado');
            if (this.token) {
                this.authenticate(this.token);
            }
        });

        this.socket.on('disconnect', () => {
            console.log('Socket desconectado');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Error de conexión:', error);
        });

        // Game events
        this.socket.on('matchFound', (data) => {
            this.emitLocal('matchFound', data);
        });

        this.socket.on('gameStart', (data) => {
            this.emitLocal('gameStart', data);
        });

        this.socket.on('wordSubmitted', (data) => {
            this.emitLocal('wordSubmitted', data);
        });

        this.socket.on('gameEnd', (data) => {
            this.emitLocal('gameEnd', data);
        });

        this.socket.on('error', (message) => {
            this.emitLocal('error', message);
        });
    }

    on(event: string, handler: Function): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    off(event: string, handler: Function): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    }

    private emitLocal(event: string, data: any): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(data));
        }
    }

    emit(event: string, data?: any): void {
        if (this.socket) {
            this.socket.emit(event, data);
        }
    }

    isConnected(): boolean {
        return this.socket?.connected || false;
    }
}
