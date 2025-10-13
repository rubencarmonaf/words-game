export class UI {
    showScreen(screenId: string): void {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
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
        const wordsList = document.getElementById('words-list');
        if (!wordsList) return;

        wordsList.innerHTML = '';
        words.forEach(word => {
            const wordElement = document.createElement('div');
            wordElement.className = 'word-item';
            wordElement.textContent = word;
            wordsList.appendChild(wordElement);
        });
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
                    <span class="player-name">${index === 0 ? '🏆 ' : ''}${player.username}</span>
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
