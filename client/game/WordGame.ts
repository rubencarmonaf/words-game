import { AuthManager } from '../auth/AuthManager';
import { UI } from '../ui/UI';
import { SocketManager } from '../socket/SocketManager';

export interface GameState {
    mode: 'solo' | 'cadena' | 'versus' | 'friendly';
    status: 'setup' | 'matchmaking' | 'active' | 'finished';
    prefix: string;
    players: any[];
    currentPlayer?: string;
    words: string[];
    timeRemaining: number;
    gameId?: string;
}

export class WordGame {
    private authManager: AuthManager;
    private ui: UI;
    private socketManager: SocketManager;
    private gameState: GameState;
    private gameTimer: number | null = null;

    constructor(authManager: AuthManager, ui: UI, socketManager: SocketManager) {
        this.authManager = authManager;
        this.ui = ui;
        this.socketManager = socketManager;
        this.gameState = {
            mode: 'solo',
            status: 'setup',
            prefix: '',
            players: [],
            words: [],
            timeRemaining: 0
        };

        this.setupSocketListeners();
    }

    private setupSocketListeners(): void {
        this.socketManager.on('matchFound', (data) => {
            this.handleMatchFound(data);
        });

        this.socketManager.on('gameStart', (data) => {
            this.handleGameStart(data);
        });

        this.socketManager.on('wordSubmitted', (data) => {
            this.handleWordSubmitted(data);
        });

        this.socketManager.on('gameEnd', (data) => {
            this.handleGameEnd(data);
        });

        this.socketManager.on('error', (message) => {
            this.ui.showMessage(message, 'error');
        });
    }

    selectGameMode(mode: string): void {
        this.gameState.mode = mode as 'solo' | 'cadena' | 'versus' | 'friendly';
        
        switch (mode) {
            case 'solo':
            case 'cadena':
            case 'friendly':
                this.ui.showGameSetup(mode);
                break;
            case 'versus':
                this.startMatchmaking();
                break;
        }
    }

    async startGame(): Promise<void> {
        const config = this.ui.getGameConfig();
        
        if (!config.prefix) {
            this.ui.showMessage('Por favor, introduce un prefijo válido', 'error');
            return;
        }

        this.gameState.prefix = config.prefix;
        if (this.gameState.mode === 'cadena') {
            // Modo cadena: jugadores genéricos
            this.gameState.players = Array.from({ length: config.playerCount }, (_, index) => ({
                id: `player-${index}`,
                username: `Jugador ${index + 1}`,
                words: [],
                score: 0
            }));
        } else {
            // Otros modos: usar nombres personalizados
            this.gameState.players = config.players.map((name: string, index: number) => ({
                id: `player-${index}`,
                username: name,
                words: [],
                score: 0
            }));
        }

        // Clear dictionary cache and game words for new game
        await this.clearDictionaryCache();
        
        this.startGameTimer();
        this.ui.showGame();
        this.ui.clearWordInput();
    }

    private startMatchmaking(): void {
        this.gameState.status = 'matchmaking';
        this.ui.showMatchmaking();
        
        this.authManager.joinMatchmaking().then(result => {
            if (!result.success) {
                this.ui.showMessage(result.message || 'Error uniéndose a matchmaking', 'error');
                this.ui.showScreen('main-menu');
            }
        });

        this.socketManager.connect();
    }

    private handleMatchFound(data: { gameId: string; opponent: string }): void {
        this.gameState.gameId = data.gameId;
        this.ui.showMessage(`¡Partida encontrada contra ${data.opponent}!`, 'success');
    }

    private async handleGameStart(data: { gameId: string; prefix: string; players: any[] }): Promise<void> {
        this.gameState.gameId = data.gameId;
        this.gameState.prefix = data.prefix;
        this.gameState.players = data.players;
        this.gameState.status = 'active';
        this.gameState.timeRemaining = 300; // 5 minutes
        
        // Clear dictionary cache and game words for new game
        await this.clearDictionaryCache();
        
        this.startGameTimer();
        this.ui.showGame();
        this.ui.clearWordInput();
    }

    private handleWordSubmitted(data: { word: string; playerId: string; score: number }): void {
        // Update UI with submitted word
        this.updateWordsDisplay();
    }

    private handleGameEnd(data: { winner: string; finalScores: any[] }): void {
        this.endGame();
        this.showResults(data.finalScores);
    }

    async submitWord(): Promise<void> {
        const word = this.ui.getCurrentWord();
        
        if (!word) return;

        // Check if word starts with prefix first
        if (!word.toLowerCase().startsWith(this.gameState.prefix.toLowerCase())) {
            this.ui.showMessage(`La palabra debe empezar con "${this.gameState.prefix}"`, 'error');
            return;
        }

        // Check if word already used
        if (this.gameState.words.includes(word.toLowerCase())) {
            this.ui.showMessage('Ya has usado esta palabra', 'error');
            return;
        }

        this.ui.setLoading(true);

        try {
            // Validate word with server
            const validation = await this.authManager.validateWord(word);
            
            if (!validation.success || !validation.data?.valid) {
                this.ui.showMessage('Palabra no válida en el diccionario español', 'error');
                this.ui.setLoading(false);
                return;
            }


            // Add word to game
            this.gameState.words.push(word.toLowerCase());
            
            // Add to current player
            const currentPlayer = this.gameState.players[0]; // For solo mode
            if (currentPlayer) {
                currentPlayer.words.push(word.toLowerCase());
                currentPlayer.score += 1;
            }

            // Update UI
            this.updateWordsDisplay();
            this.ui.showMessage(`¡"${word}" agregada!`, 'success');
            this.ui.clearWordInput();

        } catch (error) {
            this.ui.showMessage('Error validando palabra', 'error');
        } finally {
            this.ui.setLoading(false);
        }
    }

    private updateWordsDisplay(): void {
        this.ui.updateWordsList(this.gameState.words);
        this.ui.updateGameInfo(
            this.gameState.prefix,
            this.gameState.timeRemaining,
            this.gameState.words.length
        );
    }

    private startGameTimer(): void {
        if (this.gameState.mode === 'solo') {
            // Solo mode - no timer, show unlimited time
            this.ui.updateGameInfo(this.gameState.prefix, -1, this.gameState.words.length);
            return;
        }

        // Multiplayer modes - start timer
        if (this.gameState.mode === 'versus') {
            this.gameState.timeRemaining = 300; // 5 minutes
        } else if (this.gameState.mode === 'cadena') {
            this.gameState.timeRemaining = 60; // 1 minute per player
        } else {
            this.gameState.timeRemaining = 60; // 1 minute for friendly
        }
        
        this.gameTimer = window.setInterval(() => {
            this.gameState.timeRemaining -= 1;
            this.ui.updateGameInfo(
                this.gameState.prefix,
                this.gameState.timeRemaining,
                this.gameState.words.length
            );

            if (this.gameState.timeRemaining <= 0) {
                this.endGame();
            }
        }, 1000);
    }

    private async clearDictionaryCache(): Promise<void> {
        try {
            // Clear server-side dictionary cache
            await fetch('/api/clear-cache', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            // Clear local game words
            this.gameState.words = [];
            this.ui.clearWordsList();
            this.updateWordsDisplay();
            
            console.log('Dictionary cache and game words cleared');
        } catch (error) {
            console.warn('Error clearing dictionary cache:', error);
        }
    }

    endGame(): void {
        if (this.gameTimer) {
            clearInterval(this.gameTimer);
            this.gameTimer = null;
        }

        this.gameState.status = 'finished';
        
        if (this.gameState.mode === 'solo') {
            this.showResults({
                type: 'solo',
                totalWords: this.gameState.words.length
            });
        } else {
            // Multiplayer - determine winner
            const sortedPlayers = [...this.gameState.players].sort((a, b) => b.score - a.score);
            this.showResults({
                type: 'multiplayer',
                players: sortedPlayers
            });
        }
    }

    private showResults(results: any): void {
        this.ui.showResults(results);
    }

    playAgain(): void {
        this.gameState = {
            mode: this.gameState.mode,
            status: 'setup',
            prefix: '',
            players: [],
            words: [],
            timeRemaining: 0
        };

        // Clear dictionary cache for new game
        this.clearDictionaryCache();

        this.selectGameMode(this.gameState.mode);
    }

    cancelMatchmaking(): void {
        this.authManager.leaveMatchmaking();
        this.ui.showScreen('main-menu');
    }
}
