import { io } from 'socket.io-client';
import { WordGame } from './game/WordGame';
import { AuthManager } from './auth/AuthManager';
import { UI } from './ui/UI';
import { SocketManager } from './socket/SocketManager';

// Initialize the game
class GameApp {
    private authManager: AuthManager;
    private ui: UI;
    private socketManager: SocketManager;
    private wordGame: WordGame;
    
    // Daily Challenge properties
    private dailyChallenge: {
        prefix: string;
        timeLeft: number;
        words: string[];
        score: number;
        isActive: boolean;
        timer: NodeJS.Timeout | null;
    } = {
        prefix: '',
        timeLeft: 120, // 2 minutes in seconds
        words: [],
        score: 0,
        isActive: false,
        timer: null
    };

    constructor() {
        this.authManager = new AuthManager();
        this.ui = new UI();
        this.socketManager = new SocketManager();
        this.wordGame = new WordGame(this.authManager, this.ui, this.socketManager);
        
        this.initializeApp();
    }

    private initializeApp(): void {
        // Initialize logo
        this.initializeLogo();
        
        // Check if user is already logged in
        const token = localStorage.getItem('authToken');
        if (token) {
            this.authManager.setToken(token);
            // Verify token is still valid
            this.verifyTokenAndShowMenu();
        } else {
            this.showLandingPage();
        }

        this.setupEventListeners();
    }

    private initializeLogo(): void {
        // Initialize landing page logo
        this.initializeSingleLogo('logo-image', 'logo-fallback');
        
        // Initialize menu logo (no fallback needed)
        this.initializeMenuLogo('logo-image-menu');
        
        // Initialize auth screen logo (no fallback needed)
        this.initializeMenuLogo('logo-image-auth');
        
        // Initialize daily challenge logo (no fallback needed)
        this.initializeMenuLogo('logo-image-daily');
    }

    private initializeSingleLogo(imageId: string, fallbackId: string): void {
        const logoImage = document.getElementById(imageId) as HTMLImageElement;
        const logoFallback = document.getElementById(fallbackId) as HTMLElement;
        
        if (logoImage && logoFallback) {
            logoImage.onload = () => {
                logoImage.style.display = 'block';
                logoFallback.style.display = 'none';
            };
            
            logoImage.onerror = () => {
                logoImage.style.display = 'none';
                logoFallback.style.display = 'flex';
            };
            
            // Initially show fallback
            logoImage.style.display = 'none';
            logoFallback.style.display = 'flex';
        }
    }

    private initializeMenuLogo(imageId: string): void {
        const logoImage = document.getElementById(imageId) as HTMLImageElement;
        
        if (logoImage) {
            logoImage.onload = () => {
                logoImage.style.display = 'block';
            };
            
            logoImage.onerror = () => {
                console.warn('Menu logo failed to load');
                logoImage.style.display = 'none';
            };
            
            // Show image by default
            logoImage.style.display = 'block';
        }
    }

    private async verifyTokenAndShowMenu(): Promise<void> {
        try {
            const result = await this.authManager.getProfile();
            if (result.success) {
                this.showMainMenu();
                this.updateUserInfo(result.data);
            } else {
                // Token is invalid, clear it and show landing page
                this.authManager.logout();
                this.showLandingPage();
            }
        } catch (error) {
            // Network error or invalid token
            this.authManager.logout();
            this.showLandingPage();
        }
    }

    private setupEventListeners(): void {
        // Auth form listeners
        document.getElementById('login-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('register-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegister();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                this.switchAuthTab(target.dataset.tab!);
            });
        });

        // Password toggle functionality
        document.querySelectorAll('.password-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const button = target.closest('.password-toggle') as HTMLButtonElement;
                const inputId = button.dataset.target;
                const input = document.getElementById(inputId!) as HTMLInputElement;
                
                if (input.type === 'password') {
                    input.type = 'text';
                    button.classList.add('active');
                    button.querySelector('.eye-icon')!.textContent = '🙈';
                } else {
                    input.type = 'password';
                    button.classList.remove('active');
                    button.querySelector('.eye-icon')!.textContent = '👁️';
                }
            });
        });

        // Logout
        document.getElementById('logout-btn')?.addEventListener('click', () => {
            this.handleLogout();
        });

        // Game mode selection
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const modeBtn = target.closest('.mode-btn') as HTMLElement;
                if (modeBtn) {
                    const mode = modeBtn.dataset.mode;
                    if (mode) {
                        if (mode === 'lobby') {
                            this.showLobbyScreen();
                        } else {
                            this.selectGameMode(mode);
                        }
                    }
                }
            });
        });

        // Daily Challenge listeners
        document.getElementById('start-daily-challenge')?.addEventListener('click', () => {
            this.startDailyChallenge();
        });

        document.getElementById('end-daily-challenge')?.addEventListener('click', () => {
            this.endDailyChallenge();
        });

        document.getElementById('daily-submit-word')?.addEventListener('click', () => {
            this.submitDailyWord();
        });

        document.getElementById('daily-word-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.submitDailyWord();
            }
        });

        document.getElementById('back-to-menu-daily')?.addEventListener('click', () => {
            this.showMainMenu();
        });

        // Friends system
        this.setupFriendsSystem();

        // Game controls
        document.getElementById('start-game')?.addEventListener('click', () => {
            this.wordGame.startGame();
        });

        document.getElementById('back-to-menu')?.addEventListener('click', () => {
            this.showMainMenu();
        });

        document.getElementById('cancel-matchmaking')?.addEventListener('click', () => {
            this.wordGame.cancelMatchmaking();
        });

        document.getElementById('word-input')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.wordGame.submitWord();
            }
        });

        document.getElementById('submit-word')?.addEventListener('click', () => {
            this.wordGame.submitWord();
        });

        document.getElementById('end-game')?.addEventListener('click', () => {
            this.wordGame.endGame();
        });

        // Results screen
        document.getElementById('play-again')?.addEventListener('click', () => {
            this.wordGame.playAgain();
        });

        document.getElementById('new-game')?.addEventListener('click', () => {
            this.showMainMenu();
        });

        // Landing page buttons
        document.getElementById('landing-login-btn')?.addEventListener('click', () => {
            this.showAuthScreen();
            this.switchAuthTab('login');
        });

        document.getElementById('landing-register-btn')?.addEventListener('click', () => {
            this.showAuthScreen();
            this.switchAuthTab('register');
        });

        document.getElementById('hero-play-btn')?.addEventListener('click', () => {
            this.showAuthScreen();
            this.switchAuthTab('register');
        });

        document.getElementById('hero-learn-btn')?.addEventListener('click', () => {
            // Scroll to how to play section
            document.querySelector('.how-to-play-section')?.scrollIntoView({ behavior: 'smooth' });
        });

        document.getElementById('cta-register-btn')?.addEventListener('click', () => {
            this.showAuthScreen();
            this.switchAuthTab('register');
        });

        document.getElementById('cta-login-btn')?.addEventListener('click', () => {
            this.showAuthScreen();
            this.switchAuthTab('login');
        });

        // Back to landing button
        document.getElementById('back-to-landing')?.addEventListener('click', () => {
            this.showLandingPage();
        });
    }

    private async handleLogin(): Promise<void> {
        const email = (document.getElementById('login-email') as HTMLInputElement).value;
        const password = (document.getElementById('login-password') as HTMLInputElement).value;

        try {
            const result = await this.authManager.login(email, password);
            if (result.success) {
                this.showMainMenu();
                this.updateUserInfo(result.data.user);
            } else {
                this.ui.showMessage(result.message || 'Error en el login', 'error');
            }
        } catch (error) {
            this.ui.showMessage('Error de conexión', 'error');
        }
    }

    private async handleRegister(): Promise<void> {
        const username = (document.getElementById('register-username') as HTMLInputElement).value;
        const email = (document.getElementById('register-email') as HTMLInputElement).value;
        const password = (document.getElementById('register-password') as HTMLInputElement).value;

        try {
            const result = await this.authManager.register(username, email, password);
            if (result.success) {
                this.showMainMenu();
                this.updateUserInfo(result.data.user);
            } else {
                this.ui.showMessage(result.message || 'Error en el registro', 'error');
            }
        } catch (error) {
            this.ui.showMessage('Error de conexión', 'error');
        }
    }

    private handleLogout(): void {
        this.authManager.logout();
        this.showAuthScreen();
    }

    private switchAuthTab(tab: string): void {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');

        // Update forms
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(`${tab}-form`)?.classList.add('active');
    }

    private selectGameMode(mode: string): void {
        if (mode === 'daily') {
            this.showDailyChallengeScreen();
        } else {
            this.wordGame.selectGameMode(mode);
        }
    }

    private showLandingPage(): void {
        this.ui.showScreen('landing-screen');
    }

    private showAuthScreen(): void {
        this.ui.showScreen('auth-screen');
    }

    private showMainMenu(): void {
        this.ui.showScreen('main-menu');
        this.updateUserInfo();
    }

    private async updateUserInfo(user?: any): Promise<void> {
        if (!user) {
            try {
                const result = await this.authManager.getProfile();
                if (result.success) {
                    user = result.data;
                }
            } catch (error) {
                console.error('Error obteniendo perfil:', error);
            }
        }

        if (user) {
            document.getElementById('user-welcome')!.textContent = `¡Hola, ${user.username}!`;
            document.getElementById('user-elo')!.textContent = user.elo.toString();
            document.getElementById('user-games')!.textContent = user.gamesPlayed.toString();
            document.getElementById('user-wins')!.textContent = user.gamesWon.toString();
            document.getElementById('user-rate')!.textContent = `${user.winRate.toFixed(1)}%`;
        }
    }

    private setupFriendsSystem(): void {
        // Add friend button
        document.getElementById('add-friend-btn')?.addEventListener('click', () => {
            this.showAddFriendModal();
        });

        // Add friend modal events
        document.getElementById('close-add-friend')?.addEventListener('click', () => {
            this.hideAddFriendModal();
        });

        document.getElementById('cancel-add-friend')?.addEventListener('click', () => {
            this.hideAddFriendModal();
        });

        document.getElementById('send-friend-request')?.addEventListener('click', () => {
            this.sendFriendRequest();
        });

        // Lobby screen events
        document.getElementById('back-to-menu-from-lobby')?.addEventListener('click', () => {
            this.showMainMenu();
        });

        document.getElementById('leave-lobby')?.addEventListener('click', () => {
            this.leaveLobby();
        });

        document.getElementById('start-lobby-game')?.addEventListener('click', () => {
            this.startLobbyGame();
        });

        // Close modals when clicking outside
        document.getElementById('add-friend-modal')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.hideAddFriendModal();
            }
        });

    }

    private showAddFriendModal(): void {
        const modal = document.getElementById('add-friend-modal');
        if (modal) {
            modal.classList.add('show');
            (document.getElementById('friend-username') as HTMLInputElement).value = '';
        }
    }

    private hideAddFriendModal(): void {
        const modal = document.getElementById('add-friend-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    private async sendFriendRequest(): Promise<void> {
        const usernameInput = document.getElementById('friend-username') as HTMLInputElement;
        const username = usernameInput.value.trim();

        if (!username) {
            alert('Por favor ingresa un nombre de usuario');
            return;
        }

        try {
            // TODO: Implement friend request API call
            console.log(`Sending friend request to: ${username}`);
            alert(`Petición de amistad enviada a ${username}`);
            this.hideAddFriendModal();
        } catch (error) {
            console.error('Error sending friend request:', error);
            alert('Error al enviar la petición de amistad');
        }
    }

    private showLobbyScreen(): void {
        this.ui.showScreen('lobby-screen');
        this.initializeLobby();
    }

    private initializeLobby(): void {
        // TODO: Initialize lobby state
        console.log('Initializing lobby...');
        this.loadFriendsToInvite();
    }

    private async loadFriendsToInvite(): Promise<void> {
        // TODO: Load friends list for invitations
        const friendsContainer = document.getElementById('friends-to-invite');
        if (friendsContainer) {
            // For now, show mock data
            friendsContainer.innerHTML = `
                <div class="friend-to-invite">
                    <div class="friend-to-invite-info">
                        <span class="friend-to-invite-username">Amigo1</span>
                        <span class="friend-to-invite-status online">
                            <span class="status-dot online"></span>
                            En línea
                        </span>
                    </div>
                    <button class="invite-btn" data-username="Amigo1">Invitar</button>
                </div>
                <div class="friend-to-invite">
                    <div class="friend-to-invite-info">
                        <span class="friend-to-invite-username">Amigo2</span>
                        <span class="friend-to-invite-status offline">
                            <span class="status-dot offline"></span>
                            Desconectado
                        </span>
                    </div>
                    <button class="invite-btn" disabled data-username="Amigo2">Invitar</button>
                </div>
            `;
            
            // Add event listeners to invite buttons
            friendsContainer.querySelectorAll('.invite-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    const username = target.dataset.username;
                    if (username) {
                        this.inviteFriendToLobby(username);
                    }
                });
            });
        }
    }

    private async inviteFriendToLobby(username: string): Promise<void> {
        // TODO: Send invitation to friend
        console.log(`Inviting ${username} to lobby...`);
        
        // Update button state
        const inviteBtn = document.querySelector(`[data-username="${username}"]`) as HTMLButtonElement;
        if (inviteBtn) {
            inviteBtn.textContent = 'Invitado';
            inviteBtn.classList.add('invited');
            inviteBtn.disabled = true;
        }
    }

    private leaveLobby(): void {
        // TODO: Leave lobby logic
        console.log('Leaving lobby...');
        this.showMainMenu();
    }

    private startLobbyGame(): void {
        // TODO: Start lobby game logic
        console.log('Starting lobby game...');
        // Start cadena game with lobby players
        this.wordGame.selectGameMode('cadena');
    }

    // Daily Challenge Methods
    private showDailyChallengeScreen(): void {
        this.ui.showScreen('daily-challenge-screen');
        this.initializeDailyChallenge();
    }

    private initializeDailyChallenge(): void {
        // Generate daily prefix (for now, random - later will be server-generated)
        const prefixes = ['de', 'pre', 'con', 'des', 're', 'in', 'so', 'sub', 'pro', 'anti'];
        this.dailyChallenge.prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        
        // Update UI
        document.getElementById('daily-prefix')!.textContent = this.dailyChallenge.prefix;
        document.getElementById('challenge-prefix-display')!.textContent = this.dailyChallenge.prefix;
        
        // Reset challenge state
        this.dailyChallenge.timeLeft = 120;
        this.dailyChallenge.words = [];
        this.dailyChallenge.score = 0;
        this.dailyChallenge.isActive = false;
        
        // Update UI
        this.updateDailyChallengeUI();
    }

    private startDailyChallenge(): void {
        this.dailyChallenge.isActive = true;
        this.dailyChallenge.timeLeft = 120;
        this.dailyChallenge.words = [];
        this.dailyChallenge.score = 0;
        
        // Enable input
        const input = document.getElementById('daily-word-input') as HTMLInputElement;
        const submitBtn = document.getElementById('daily-submit-word') as HTMLButtonElement;
        const startBtn = document.getElementById('start-daily-challenge') as HTMLButtonElement;
        const endBtn = document.getElementById('end-daily-challenge') as HTMLButtonElement;
        
        input.disabled = false;
        submitBtn.disabled = false;
        startBtn.style.display = 'none';
        endBtn.style.display = 'inline-block';
        
        // Start timer
        this.startDailyTimer();
        
        // Focus input
        input.focus();
    }

    private startDailyTimer(): void {
        this.dailyChallenge.timer = setInterval(() => {
            this.dailyChallenge.timeLeft--;
            this.updateDailyChallengeUI();
            
            if (this.dailyChallenge.timeLeft <= 0) {
                this.endDailyChallenge();
            }
        }, 1000);
    }

    private endDailyChallenge(): void {
        this.dailyChallenge.isActive = false;
        
        if (this.dailyChallenge.timer) {
            clearInterval(this.dailyChallenge.timer);
            this.dailyChallenge.timer = null;
        }
        
        // Disable input
        const input = document.getElementById('daily-word-input') as HTMLInputElement;
        const submitBtn = document.getElementById('daily-submit-word') as HTMLButtonElement;
        const startBtn = document.getElementById('start-daily-challenge') as HTMLButtonElement;
        const endBtn = document.getElementById('end-daily-challenge') as HTMLButtonElement;
        
        input.disabled = true;
        submitBtn.disabled = true;
        startBtn.style.display = 'inline-block';
        endBtn.style.display = 'none';
        
        // Show results
        this.showDailyChallengeResults();
    }

    private async submitDailyWord(): Promise<void> {
        const input = document.getElementById('daily-word-input') as HTMLInputElement;
        const word = input.value.trim().toLowerCase();
        
        if (!word) return;
        
        // Check if word starts with prefix
        if (!word.startsWith(this.dailyChallenge.prefix)) {
            this.showDailyMessage(`La palabra debe empezar con "${this.dailyChallenge.prefix}"`, 'error');
            return;
        }
        
        // Check if word already used
        if (this.dailyChallenge.words.includes(word)) {
            this.showDailyMessage('Ya has usado esta palabra', 'error');
            return;
        }
        
        // Validate word with API
        try {
            const response = await fetch('/api/validate-word', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                },
                body: JSON.stringify({ word })
            });
            
            const result = await response.json();
            
            if (result.valid) {
                this.dailyChallenge.words.push(word);
                this.dailyChallenge.score += this.calculateWordScore(word);
                this.updateDailyChallengeUI();
                this.showDailyMessage(`¡Palabra válida! +${this.calculateWordScore(word)} puntos`, 'success');
                input.value = '';
            } else {
                this.showDailyMessage('Palabra no válida', 'error');
            }
        } catch (error) {
            console.error('Error validating word:', error);
            this.showDailyMessage('Error validando la palabra', 'error');
        }
    }

    private calculateWordScore(word: string): number {
        // Score based on word length
        const baseScore = word.length * 10;
        const bonusScore = word.length > 8 ? 50 : word.length > 6 ? 25 : 0;
        return baseScore + bonusScore;
    }

    private updateDailyChallengeUI(): void {
        // Update timer
        const minutes = Math.floor(this.dailyChallenge.timeLeft / 60);
        const seconds = this.dailyChallenge.timeLeft % 60;
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        document.getElementById('challenge-time-left')!.textContent = timeString;
        document.getElementById('daily-time-left')!.textContent = timeString;
        
        // Update stats
        document.getElementById('challenge-words-count')!.textContent = this.dailyChallenge.words.length.toString();
        document.getElementById('challenge-score')!.textContent = this.dailyChallenge.score.toString();
        
        // Update words list
        const wordsList = document.getElementById('daily-words-list')!;
        wordsList.innerHTML = '';
        
        this.dailyChallenge.words.forEach(word => {
            const wordElement = document.createElement('div');
            wordElement.className = 'word-item';
            wordElement.textContent = word;
            wordsList.appendChild(wordElement);
        });
    }

    private showDailyMessage(message: string, type: 'success' | 'error'): void {
        // Create temporary message element
        const messageEl = document.createElement('div');
        messageEl.className = `daily-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 10px 20px;
            border-radius: 8px;
            color: white;
            font-weight: bold;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
        `;
        
        document.body.appendChild(messageEl);
        
        // Remove after 3 seconds
        setTimeout(() => {
            messageEl.remove();
        }, 3000);
    }

    private showDailyChallengeResults(): void {
        const message = `¡Reto completado! Encontraste ${this.dailyChallenge.words.length} palabras y obtuviste ${this.dailyChallenge.score} puntos.`;
        this.showDailyMessage(message, 'success');
        
        // TODO: Save results to server
        console.log('Daily challenge results:', {
            prefix: this.dailyChallenge.prefix,
            words: this.dailyChallenge.words,
            score: this.dailyChallenge.score,
            timeLeft: this.dailyChallenge.timeLeft
        });
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    new GameApp();
});
