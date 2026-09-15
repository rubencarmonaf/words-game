const SCREEN_TITLES: Record<string, string> = {
    'landing-screen': 'WordWars — Batallas de palabras en tiempo real',
    'auth-screen': 'Iniciar sesión · WordWars',
    'main-menu': 'Menú · WordWars',
    'lobby-screen': 'Sala de espera · WordWars',
    'daily-challenge-screen': 'Reto diario · WordWars',
    'game-setup': 'Configurar partida · WordWars',
    'matchmaking-screen': 'Buscando partida · WordWars',
    'game-screen': 'Partida en curso · WordWars',
    'results-screen': 'Resultados · WordWars',
    'profile-screen': 'Perfil · WordWars'
};

// Iconos reutilizados del set de modos de juego + una estrella para el picker de avatar
const AVATAR_ICONS: Record<string, string> = {
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4"/>',
    link: '<path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>',
    bolt: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    users: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 002.5 2.5z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'
};

function avatarSvg(icon: string): string {
    const path = AVATAR_ICONS[icon] || AVATAR_ICONS.target;
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

// Los tiers de ELO son la fuente del "nivel" del carnet de perfil — ningún dato inventado,
// reutilizan el mismo significado de color de línea que ya tienen los modos de juego.
// Bandas de 500 ELO. El ELO arranca en 0 (K=60 → ~30 puntos por victoria entre
// rivales iguales), así que subir un tramo cuesta ~17 victorias netas.
const ELO_TIERS = [
    { key: 'cobalt', name: 'Aprendiz', min: 0, max: 500 },
    { key: 'lime', name: 'Viajero', min: 500, max: 1000 },
    { key: 'amber', name: 'Experto', min: 1000, max: 1500 },
    { key: 'scarlet', name: 'Leyenda', min: 1500, max: null as number | null }
];

function eloTier(elo: number) {
    return ELO_TIERS.find(t => elo >= t.min && (t.max === null || elo < t.max)) || ELO_TIERS[0];
}

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

    // ---------- Identidad / perfil ----------

    applyAvatar(elementId: string, color: string, icon: string, size: 'sm' | 'lg'): void {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = `ww-avatar ww-avatar--${size} ww-avatar--${color}`;
        el.innerHTML = avatarSvg(icon);
    }

    updateIdentityChip(user: any): void {
        this.applyAvatar('user-avatar-chip', user.avatarColor || 'cobalt', user.avatarIcon || 'target', 'sm');
        const name = document.getElementById('user-welcome');
        if (name) name.textContent = user.username;
    }

    showProfile(user: any): void {
        this.showScreen('profile-screen');
        this.renderProfile(user);
    }

    renderProfile(user: any): void {
        this.applyAvatar('profile-avatar', user.avatarColor || 'cobalt', user.avatarIcon || 'target', 'lg');

        const nameEl = document.getElementById('profile-username');
        if (nameEl) nameEl.textContent = user.username;

        const tier = eloTier(user.elo);
        const badge = document.getElementById('profile-tier');
        if (badge) badge.className = `ww-tier-badge ww-tier-badge--${tier.key}`;
        const tierName = document.getElementById('profile-tier-name');
        if (tierName) tierName.textContent = tier.name;

        const bar = document.getElementById('profile-tier-progress') as HTMLElement;
        const label = document.getElementById('profile-tier-label');
        if (tier.max === null) {
            if (bar) bar.style.setProperty('--fill', '1');
            if (label) label.textContent = `${user.elo} ELO · nivel máximo`;
        } else {
            const pct = Math.max(0, Math.min(1, (user.elo - tier.min) / (tier.max - tier.min)));
            if (bar) bar.style.setProperty('--fill', pct.toString());
            if (label) label.textContent = `${user.elo} ELO · ${tier.max - user.elo} para el siguiente nivel`;
        }

        const elo = document.getElementById('profile-elo');
        if (elo) elo.textContent = user.elo.toString();
        const games = document.getElementById('profile-games');
        if (games) games.textContent = user.gamesPlayed.toString();
        const wins = document.getElementById('profile-wins');
        if (wins) wins.textContent = user.gamesWon.toString();
        const rate = document.getElementById('profile-rate');
        if (rate) rate.textContent = `${user.winRate.toFixed(1)}%`;

        const usernameInput = document.getElementById('profile-username-input') as HTMLInputElement;
        if (usernameInput) usernameInput.value = user.username;
        this.setAvatarPickerSelection(user.avatarColor || 'cobalt', user.avatarIcon || 'target');
    }

    setAvatarPickerSelection(color: string, icon: string): void {
        document.querySelectorAll('.ww-color-swatch').forEach(btn => {
            btn.classList.toggle('selected', (btn as HTMLElement).dataset.color === color);
        });
        document.querySelectorAll('.ww-icon-swatch').forEach(btn => {
            btn.classList.toggle('selected', (btn as HTMLElement).dataset.icon === icon);
        });
    }

    showResults(results: any, won: boolean = false): void {
        this.showScreen('results-screen');

        const resultsDisplay = document.getElementById('results-display');
        if (!resultsDisplay) return;

        resultsDisplay.innerHTML = '';
        document.getElementById('ww-victory')?.remove();

        let finalScore = 0;

        if (results.type === 'solo') {
            finalScore = results.totalWords;
            resultsDisplay.innerHTML = `
                <div class="player-result">
                    <span class="player-name">¡Excelente trabajo!</span>
                    <span class="player-score">${results.totalWords} palabras</span>
                </div>
            `;
        } else {
            // Multiplayer results
            finalScore = results.players[0]?.score ?? 0;
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

        if (won) {
            this.playVictorySequence(finalScore, 'palabras');
        }
    }

    // Momento de llegada a la terminal: la línea se dibuja hasta un roundel,
    // el marcador gira como un panel de salidas y caen unas partículas con
    // las formas del propio sistema (roundels/paradas), no confeti genérico.
    private playVictorySequence(score: number, unit: string): void {
        const content = document.querySelector('.results-content');
        if (!content) return;

        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const digits = String(score).padStart(2, '0').split('');
        const colors = ['scarlet', 'cobalt', 'amber', 'lime'];

        const flapCells = '0123456789'.split('').map(d => `<span class="ww-flap-cell">${d}</span>`).join('');

        const overlay = document.createElement('div');
        overlay.id = 'ww-victory';
        overlay.className = 'ww-victory';
        overlay.setAttribute('aria-hidden', 'true');
        overlay.innerHTML = `
            <div class="ww-victory-track">
                <svg class="ww-victory-line" viewBox="0 0 320 56" preserveAspectRatio="none">
                    <path class="ww-victory-path" d="M0,30 C90,30 108,8 160,8 S 232,30 320,30" />
                </svg>
                <span class="ww-victory-roundel">✓</span>
            </div>
            <div class="ww-victory-score">
                ${digits.map(() => `<span class="ww-flap"><span class="ww-flap-strip">${flapCells}</span></span>`).join('')}
                <span class="ww-victory-unit">${unit}</span>
            </div>
            <div class="ww-victory-particles"></div>
        `;
        content.prepend(overlay);

        if (reduced) {
            overlay.querySelectorAll('.ww-flap-strip').forEach((strip, i) => {
                (strip as HTMLElement).style.transform = `translateY(-${Number(digits[i]) * 10}%)`;
            });
            return;
        }

        // Reproduce la animación de dibujo de línea (definida en CSS) y,
        // cuando llega al roundel, dispara el marcador y las partículas.
        window.setTimeout(() => {
            overlay.querySelector('.ww-victory-roundel')?.classList.add('ww-victory-roundel--lit');
            overlay.querySelectorAll<HTMLElement>('.ww-flap-strip').forEach((strip, i) => {
                window.setTimeout(() => {
                    strip.style.transform = `translateY(-${Number(digits[i]) * 10}%)`;
                }, i * 90);
            });
            this.spawnVictoryParticles(overlay.querySelector('.ww-victory-particles') as HTMLElement, colors);
        }, 650);
    }

    private spawnVictoryParticles(container: HTMLElement | null, colors: string[]): void {
        if (!container) return;
        const shapes: Array<'dot' | 'dash'> = ['dot', 'dash'];

        for (let i = 0; i < 16; i++) {
            const particle = document.createElement('span');
            const color = colors[i % colors.length];
            const shape = shapes[i % shapes.length];
            const angle = (Math.PI * 2 * i) / 16 + (Math.random() - 0.5) * 0.4;
            const distance = 60 + Math.random() * 70;
            particle.className = `ww-victory-particle ww-victory-particle--${shape} ww-victory-particle--${color}`;
            particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
            particle.style.setProperty('--dy', `${Math.sin(angle) * distance - 20}px`);
            particle.style.setProperty('--delay', `${Math.random() * 120}ms`);
            container.appendChild(particle);
        }

        window.setTimeout(() => container.replaceChildren(), 1400);
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
