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
    private resetToken: string | null = null;

    // Daily Challenge properties
    private dailyChallenge: {
        prefix: string;
        timeLeft: number;
        words: string[];
        score: number;
        isActive: boolean;
        isCompleted: boolean;
        timer: NodeJS.Timeout | null;
    } = {
        prefix: '',
        timeLeft: 120, // 2 minutes in seconds
        words: [],
        score: 0,
        isActive: false,
        isCompleted: false,
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

        this.setupEventListeners();

        // Reset de contraseña: si la URL trae ?reset=TOKEN, mostramos el formulario de reseteo
        const resetToken = new URLSearchParams(window.location.search).get('reset');
        if (resetToken) {
            this.resetToken = resetToken;
            this.showAuthScreen();
            this.showResetForm();
            return;
        }

        // Check if user is already logged in
        const token = localStorage.getItem('authToken');
        if (token) {
            this.authManager.setToken(token);
            // Verify token is still valid
            this.verifyTokenAndShowMenu();
        } else {
            this.showLandingPage();
        }
        this.setupScrollReveal();
    }

    // Reveal landing sections as they scroll into view
    private setupScrollReveal(): void {
        const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
        if (!targets.length) return;

        if (!('IntersectionObserver' in window)) {
            targets.forEach(el => el.classList.add('ww-in'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('ww-in');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

        targets.forEach(el => observer.observe(el));
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
                    button.setAttribute('aria-label', 'Ocultar contraseña');
                } else {
                    input.type = 'password';
                    button.classList.remove('active');
                    button.setAttribute('aria-label', 'Mostrar contraseña');
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
            document.getElementById('como')?.scrollIntoView({ behavior: 'smooth' });
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

        // Password reset flow
        document.getElementById('forgot-password-link')?.addEventListener('click', () => {
            this.showForgotForm();
        });

        document.getElementById('forgot-back-link')?.addEventListener('click', () => {
            this.switchAuthTab('login');
        });

        document.getElementById('reset-back-link')?.addEventListener('click', () => {
            this.resetToken = null;
            this.clearResetQueryParam();
            this.switchAuthTab('login');
        });

        document.getElementById('forgot-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleForgotPassword();
        });

        document.getElementById('reset-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleResetPassword();
        });
    }

    private async handleLogin(): Promise<void> {
        const email = (document.getElementById('login-email') as HTMLInputElement).value;
        const password = (document.getElementById('login-password') as HTMLInputElement).value;

        try {
            const result = await this.authManager.login(email, password);
            if (result.success && result.data) {
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
            if (result.success && result.data) {
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
        // Las pestañas login/register vuelven a ser visibles
        document.querySelector('.auth-tabs')?.classList.remove('auth-tabs-hidden');

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

    // Muestra un formulario de auth (forgot/reset) ocultando las pestañas login/register
    private showAuthOnlyForm(formId: string): void {
        document.querySelector('.auth-tabs')?.classList.add('auth-tabs-hidden');
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
        });
        document.getElementById(formId)?.classList.add('active');
    }

    private showForgotForm(): void {
        this.showAuthOnlyForm('forgot-form');
    }

    private showResetForm(): void {
        this.showAuthOnlyForm('reset-form');
    }

    private clearResetQueryParam(): void {
        const url = new URL(window.location.href);
        url.searchParams.delete('reset');
        window.history.replaceState({}, document.title, url.pathname + url.search);
    }

    private async handleForgotPassword(): Promise<void> {
        const email = (document.getElementById('forgot-email') as HTMLInputElement).value.trim();
        if (!email) {
            this.ui.showMessage('Introduce tu email', 'error');
            return;
        }

        try {
            const result = await this.authManager.forgotPassword(email);
            if (result.success) {
                this.ui.showMessage(
                    result.data?.message || 'Si el email está registrado, recibirás un enlace.',
                    'success'
                );
                this.switchAuthTab('login');
            } else {
                this.ui.showMessage(result.message || 'No se pudo procesar la solicitud', 'error');
            }
        } catch (error) {
            this.ui.showMessage('Error de conexión', 'error');
        }
    }

    private async handleResetPassword(): Promise<void> {
        const password = (document.getElementById('reset-password') as HTMLInputElement).value;
        const confirm = (document.getElementById('reset-password-confirm') as HTMLInputElement).value;

        if (password.length < 6) {
            this.ui.showMessage('La contraseña debe tener al menos 6 caracteres', 'error');
            return;
        }
        if (password !== confirm) {
            this.ui.showMessage('Las contraseñas no coinciden', 'error');
            return;
        }
        if (!this.resetToken) {
            this.ui.showMessage('Enlace de reseteo no válido', 'error');
            return;
        }

        try {
            const result = await this.authManager.resetPassword(this.resetToken, password);
            if (result.success) {
                this.ui.showMessage(result.data?.message || 'Contraseña actualizada. Inicia sesión.', 'success');
                this.resetToken = null;
                this.clearResetQueryParam();
                this.switchAuthTab('login');
            } else {
                this.ui.showMessage(result.message || 'No se pudo restablecer la contraseña', 'error');
            }
        } catch (error) {
            this.ui.showMessage('Error de conexión', 'error');
        }
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
        this.updateDailyChallengeStatus();
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

    private async initializeDailyChallenge(): Promise<void> {
        try {
            // Get daily challenge from server
            const result = await this.authManager.getDailyChallenge();
            
            if (result.success) {
                const challenge = result.data.challenge;
                this.dailyChallenge.prefix = challenge.prefix;
                
                
                // Check if already completed
                if (result.data.isCompleted) {
                    this.showDailyChallengeCompleted(result.data.wordsFound);
                    return;
                }
        
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
            } else {
                this.ui.showMessage('Error cargando el reto diario', 'error');
            }
        } catch (error) {
            console.error('Error initializing daily challenge:', error);
            this.ui.showMessage('Error de conexión', 'error');
        }
    }

    private startDailyChallenge(): void {
        // Check if already completed today
        this.checkDailyChallengeStatus();
        
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

    private async endDailyChallenge(): Promise<void> {
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
        startBtn.style.display = 'none'; // Hide start button permanently
        endBtn.style.display = 'none';
        
        // Send words to server
        if (this.dailyChallenge.words.length >= 3) {
            try {
                const result = await this.authManager.completeDailyChallenge(this.dailyChallenge.words);
                if (result.success) {
                    this.showDailyMessage(result.data.message, 'success');
                    // Mark as completed locally
                    this.dailyChallenge.isCompleted = true;
                } else {
                    this.showDailyMessage(result.message || 'Error completando el reto', 'error');
                }
            } catch (error) {
                console.error('Error completing daily challenge:', error);
                this.showDailyMessage('Error de conexión', 'error');
            }
        } else {
            this.showDailyMessage('Necesitas al menos 3 palabras para completar el reto', 'error');
        }
        
        // Show results
        this.showDailyChallengeResults();
        
        // Return to main menu after completion
        setTimeout(() => {
            this.showMainMenu();
            this.updateDailyChallengeStatus();
        }, 3000); // Wait 3 seconds to show completion message
    }

    private async checkDailyChallengeStatus(): Promise<void> {
        try {
            const result = await this.authManager.getDailyChallenge();
            if (result.success && result.data.isCompleted) {
                // Already completed, show completed state
                this.showDailyChallengeCompleted(result.data.wordsFound);
                return;
            }
        } catch (error) {
            console.error('Error checking daily challenge status:', error);
        }
    }

    private async submitDailyWord(): Promise<void> {
        const input = document.getElementById('daily-word-input') as HTMLInputElement;
        const word = input.value.trim().toLowerCase();
        
        if (!word) return;
        
        
        // Check if word starts with prefix (convert both to lowercase for comparison)
        if (!word.startsWith(this.dailyChallenge.prefix.toLowerCase())) {
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
            const validation = await this.authManager.validateWord(word);
            
            if (!validation.success || !validation.data?.valid) {
                this.showDailyMessage('Palabra no válida en el diccionario español', 'error');
                return;
            }
            
            // Add word to local list
            this.dailyChallenge.words.push(word);
            this.updateDailyChallengeUI();
            this.updateDailyWordsList();
            this.showDailyMessage(`¡Palabra válida!`, 'success');
            input.value = '';
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
    }

    private updateDailyWordsList(): void {
        // Update words list only when words change
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
        const message = `¡Reto completado! Encontraste ${this.dailyChallenge.words.length} palabras.`;
        this.showDailyMessage(message, 'success');
    }

    private showDailyChallengeCompleted(wordsFound: string[]): void {
        // Show completed state
        document.getElementById('daily-prefix')!.textContent = this.dailyChallenge.prefix;
        document.getElementById('challenge-prefix-display')!.textContent = this.dailyChallenge.prefix;
        
        // Disable all inputs
        const input = document.getElementById('daily-word-input') as HTMLInputElement;
        const submitBtn = document.getElementById('daily-submit-word') as HTMLButtonElement;
        const startBtn = document.getElementById('start-daily-challenge') as HTMLButtonElement;
        const endBtn = document.getElementById('end-daily-challenge') as HTMLButtonElement;
        
        input.disabled = true;
        submitBtn.disabled = true;
        startBtn.style.display = 'none';
        endBtn.style.display = 'none';
        
        // Show completed message
        const completedMessage = document.createElement('div');
        completedMessage.className = 'daily-completed-message';
        completedMessage.innerHTML = `
            <h3>¡Reto completado!</h3>
            <p>Ya completaste el reto de hoy con ${wordsFound.length} palabras:</p>
            <div class="completed-words">
                ${wordsFound.map(word => `<span class="completed-word">${word}</span>`).join('')}
            </div>
        `;
        completedMessage.style.cssText = `
            text-align: center;
            padding: 20px;
            background: #d4edda;
            border: 1px solid #c3e6cb;
            border-radius: 8px;
            margin: 20px 0;
            color: #155724;
        `;
        
        // Insert after the challenge info
        const challengeInfo = document.querySelector('.challenge-info');
        if (challengeInfo) {
            challengeInfo.insertAdjacentElement('afterend', completedMessage);
        }
        
        // Update words list
        this.dailyChallenge.words = wordsFound;
        this.updateDailyChallengeUI();
        this.updateDailyWordsList();
    }

    private async updateDailyChallengeStatus(): Promise<void> {
        try {
            const result = await this.authManager.getDailyChallenge();
            if (result.success) {
                const dailyPrefixElement = document.getElementById('daily-prefix');
                const dailyTimerElement = document.getElementById('daily-timer');
                
                if (dailyPrefixElement && dailyTimerElement) {
                    const dailyChallengeBtn = document.querySelector('.daily-challenge-btn');
                    
                    if (result.data.isCompleted) {
                        // Show completed status with countdown
                        dailyPrefixElement.innerHTML = `✅ Completado`;
                        dailyTimerElement.style.display = 'block';
                        dailyTimerElement.innerHTML = `
                            <span class="timer-text">Próximo reto en: <span id="countdown-timer" class="countdown-timer">--:--:--</span></span>
                        `;
                        
                        // Add completed class to button
                        if (dailyChallengeBtn) {
                            dailyChallengeBtn.classList.add('completed');
                        }
                        
                        // Start countdown timer
                        this.startDailyCountdown(result.data.timeUntilNext);
                    } else {
                        // Show available status
                        dailyPrefixElement.textContent = result.data.challenge.prefix;
                        dailyTimerElement.style.display = 'none';
                        
                        // Remove completed class from button
                        if (dailyChallengeBtn) {
                            dailyChallengeBtn.classList.remove('completed');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error updating daily challenge status:', error);
        }
    }

    private startDailyCountdown(timeUntilNext: any): void {
        if (!timeUntilNext) return;
        
        let totalSeconds = timeUntilNext.totalSeconds;
        
        const updateCountdown = () => {
            if (totalSeconds <= 0) {
                // Refresh the status when countdown reaches zero
                this.updateDailyChallengeStatus();
                return;
            }
            
            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;
            
            const timeString = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            
            const countdownTimer = document.getElementById('countdown-timer');
            if (countdownTimer) {
                countdownTimer.textContent = timeString;
            }
            
            totalSeconds--;
        };
        
        // Update immediately
        updateCountdown();
        
        // Update every second
        const countdownInterval = setInterval(() => {
            updateCountdown();
            if (totalSeconds <= 0) {
                clearInterval(countdownInterval);
            }
        }, 1000);
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', () => {
    new GameApp();
});
