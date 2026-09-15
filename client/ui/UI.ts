const SCREEN_TITLES: Record<string, string> = {
    'landing-screen': 'WordWars — Batallas de palabras en tiempo real',
    'auth-screen': 'Iniciar sesión · WordWars',
    'main-menu': 'Menú · WordWars',
    'lobby-screen': 'Sala de espera · WordWars',
    'daily-challenge-screen': 'Reto diario · WordWars',
    'game-setup': 'Configurar partida · WordWars',
    'matchmaking-screen': 'Buscando partida · WordWars',
    'game-screen': 'Partida en curso · WordWars',
    'results-screen': 'Resultados · WordWars'
};

const MATCHMAKING_PHRASES = [
    'Buscando línea disponible…',
    'Comprobando ELO similar…',
    'Confirmando andén…',
    'Casi listo para embarcar…'
];

export class UI {
    private matchmakingInterval: number | null = null;

    showScreen(screenId: string): void {
        if (screenId !== 'matchmaking-screen') {
            this.stopMatchmakingSearch();
        }

        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }

        document.title = SCREEN_TITLES[screenId] || 'WordWars';
    }

    // ---------- Estados de error en formularios ----------

    showFieldError(inputId: string, message: string): void {
        const input = document.getElementById(inputId) as HTMLInputElement;
        if (!input) return;

        const group = input.closest('.input-group');
        if (!group) return;

        group.classList.add('has-error');

        let errorEl = group.querySelector('.field-error');
        if (!errorEl) {
            errorEl = document.createElement('span');
            errorEl.className = 'field-error';
            group.appendChild(errorEl);
        }
        errorEl.textContent = message;
    }

    // Marca el campo como inválido (borde rojo) sin añadir texto de error propio,
    // útil para acompañar a otro campo que ya muestra el mensaje (p.ej. email+password).
    flagField(inputId: string): void {
        const input = document.getElementById(inputId) as HTMLInputElement;
        input?.closest('.input-group')?.classList.add('has-error');
    }

    clearFieldError(inputId: string): void {
        const input = document.getElementById(inputId) as HTMLInputElement;
        if (!input) return;

        const group = input.closest('.input-group');
        if (!group) return;

        group.classList.remove('has-error');
        group.querySelector('.field-error')?.remove();
    }

    clearFormErrors(formId: string): void {
        const form = document.getElementById(formId);
        if (!form) return;

        form.querySelectorAll('.input-group.has-error').forEach(group => {
            group.classList.remove('has-error');
            group.querySelector('.field-error')?.remove();
        });
    }

    showMessage(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
        // Remove existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        // Create message element
        const messageElement = document.createElement('div');
        messageElement.className = `message message-${type}`;
        messageElement.textContent = message;
        
        // Style the message
        messageElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 10px;
            color: white;
            font-weight: 600;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            background: ${this.getMessageColor(type)};
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            max-width: 300px;
            word-wrap: break-word;
        `;

        document.body.appendChild(messageElement);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            messageElement.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => messageElement.remove(), 300);
        }, 3000);
    }

    private getMessageColor(type: string): string {
        switch (type) {
            case 'success': return '#28a745';
            case 'error': return '#dc3545';
            case 'info': return '#17a2b8';
            default: return '#6c757d';
        }
    }

    updateGameInfo(prefix: string, timeRemaining: number, wordCount: number): void {
        const prefixElement = document.getElementById('current-prefix');
        const timerElement = document.getElementById('game-timer');
        const wordCountElement = document.getElementById('word-count');

        if (prefixElement) prefixElement.textContent = prefix.toUpperCase();
        if (timerElement) {
            if (timeRemaining === -1) {
                // Solo mode - show unlimited time
                timerElement.textContent = '∞';
                timerElement.classList.remove('timer-warning', 'timer-danger');
            } else {
                const minutes = Math.floor(timeRemaining / 60);
                const seconds = timeRemaining % 60;
                timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
                
                // Add warning styles for low time
                timerElement.classList.remove('timer-warning', 'timer-danger');
                if (timeRemaining <= 30) {
                    timerElement.classList.add('timer-warning');
                }
                if (timeRemaining <= 10) {
                    timerElement.classList.add('timer-danger');
                }
            }
        }
        if (wordCountElement) wordCountElement.textContent = `Palabras: ${wordCount}`;
    }

    updateWordsList(words: string[]): void {
        this.syncWordItems('words-list', words);
    }

    // Añade solo las palabras nuevas (con animación de "llegada"), en vez de
    // reconstruir toda la lista en cada envío. Si la lista se acorta (partida
    // nueva), se reconstruye sin animación.
    syncWordItems(containerId: string, words: string[]): void {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (words.length < container.children.length) {
            container.innerHTML = '';
        }

        for (let i = container.children.length; i < words.length; i++) {
            const wordElement = document.createElement('div');
            wordElement.className = 'word-item word-item--enter';
            wordElement.textContent = words[i];
            container.appendChild(wordElement);
        }
    }

    clearWordsList(): void {
        const wordsList = document.getElementById('words-list');
        if (wordsList) {
            wordsList.innerHTML = '';
        }
    }

    clearWordInput(): void {
        const wordInput = document.getElementById('word-input') as HTMLInputElement;
        if (wordInput) {
            wordInput.value = '';
            wordInput.focus();
        }
    }

    // Micro-shake en el input cuando se rechaza una palabra (acompaña al toast, no lo sustituye)
    flashInputError(inputId: string): void {
        const input = document.getElementById(inputId) as HTMLInputElement;
        if (!input) return;
        input.classList.remove('word-input--shake');
        void input.offsetWidth; // reinicia la animación si se dispara dos veces seguidas
        input.classList.add('word-input--shake');
        window.setTimeout(() => input.classList.remove('word-input--shake'), 900);
    }

    showGameSetup(mode: string): void {
        this.showScreen('game-setup');
        
        const title = document.getElementById('setup-title');
        const playerConfig = document.getElementById('player-config');
        const playerNames = document.getElementById('player-names');

        if (!title) return;

        switch (mode) {
            case 'solo':
                title.textContent = 'Modo Solo - Práctica';
                if (playerConfig) playerConfig.style.display = 'none';
                if (playerNames) playerNames.style.display = 'none';
                break;
            case 'cadena':
                title.textContent = 'Modo Cadena - Eliminación';
                if (playerConfig) playerConfig.style.display = 'block';
                if (playerNames) playerNames.style.display = 'none';
                break;
            case 'friendly':
                title.textContent = 'Juego con Amigos';
                if (playerConfig) playerConfig.style.display = 'block';
                if (playerNames) playerNames.style.display = 'block';
                this.updatePlayerNames();
                break;
        }
    }

    showMatchmaking(): void {
        this.showScreen('matchmaking-screen');
        this.startMatchmakingSearch();
    }

    private startMatchmakingSearch(): void {
        const status = document.getElementById('matchmaking-status');
        if (!status) return;

        let i = 0;
        status.textContent = MATCHMAKING_PHRASES[0];
        this.matchmakingInterval = window.setInterval(() => {
            i = (i + 1) % MATCHMAKING_PHRASES.length;
            status.classList.add('ww-search-status--out');
            window.setTimeout(() => {
                status.textContent = MATCHMAKING_PHRASES[i];
                status.classList.remove('ww-search-status--out');
            }, 200);
        }, 2600);
    }

    private stopMatchmakingSearch(): void {
        if (this.matchmakingInterval !== null) {
            window.clearInterval(this.matchmakingInterval);
            this.matchmakingInterval = null;
        }
    }

    showGame(): void {
        this.showScreen('game-screen');
    }

    showResults(results: any): void {
        this.showScreen('results-screen');
        
        const resultsDisplay = document.getElementById('results-display');
        if (!resultsDisplay) return;

        resultsDisplay.innerHTML = '';

        if (results.type === 'solo') {
            resultsDisplay.innerHTML = `
                <div class="player-result">
                    <span class="player-name">¡Excelente trabajo!</span>
                    <span class="player-score">${results.totalWords} palabras</span>
                </div>
            `;
        } else {
            // Multiplayer results
            results.players.forEach((player: any, index: number) => {
                const playerElement = document.createElement('div');
                playerElement.className = index === 0 ? 'player-result winner' : 'player-result';
                playerElement.innerHTML = `
                    <span class="player-name">${index === 0 ? '<span class="board-badge board-badge--amber">Ganador</span> ' : ''}${player.username}</span>
                    <span class="player-score">${player.score} palabras</span>
                `;
                resultsDisplay.appendChild(playerElement);
            });
        }
    }

    private updatePlayerNames(): void {
        const playerCount = parseInt((document.getElementById('player-count') as HTMLInputElement)?.value || '2');
        const namesContainer = document.getElementById('names-container');
        
        if (!namesContainer) return;
        
        namesContainer.innerHTML = '';

        for (let i = 0; i < playerCount; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'name-input';
            input.placeholder = `Jugador ${i + 1}`;
            input.value = `Jugador ${i + 1}`;
            namesContainer.appendChild(input);
        }
    }

    getGameConfig(): any {
        const prefix = (document.getElementById('prefix-input') as HTMLInputElement)?.value || '';
        const playerCount = parseInt((document.getElementById('player-count') as HTMLInputElement)?.value || '2');
        
        const players: string[] = [];
        const nameInputs = document.querySelectorAll('.name-input');
        nameInputs.forEach(input => {
            const value = (input as HTMLInputElement).value.trim();
            players.push(value || (input as HTMLInputElement).placeholder);
        });

        return {
            prefix: prefix.toLowerCase().trim(),
            players,
            playerCount
        };
    }

    getCurrentWord(): string {
        const wordInput = document.getElementById('word-input') as HTMLInputElement;
        return wordInput?.value || '';
    }

    setLoading(loading: boolean): void {
        const submitBtn = document.getElementById('submit-word') as HTMLButtonElement;
        if (submitBtn) {
            submitBtn.disabled = loading;
            submitBtn.textContent = loading ? 'Validando...' : 'Enviar';
        }
    }
}
