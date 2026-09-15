import { loadAnalytics } from './analytics';

const STORAGE_KEY = 'ww_cookie_consent';

interface CookieConsent {
    necessary: true;
    analytics: boolean;
    timestamp: number;
}

function getStoredConsent(): CookieConsent | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function storeConsent(analytics: boolean): void {
    const consent: CookieConsent = { necessary: true, analytics, timestamp: Date.now() };
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
    } catch {
        // localStorage no disponible (modo privado, etc.) — seguimos sin persistir la elección
    }
    if (analytics) {
        loadAnalytics();
    }
}

function buildBanner(): HTMLElement {
    const banner = document.createElement('div');
    banner.className = 'ww-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Preferencias de cookies');

    banner.innerHTML = `
        <p>
            Usamos cookies y almacenamiento local necesarios para que WordWars funcione (tu sesión de juego) y,
            si nos das permiso, cookies analíticas para entender cómo se usa el sitio. Puedes leer más en nuestra
            <a href="./cookies.html">Política de Cookies</a>.
        </p>
        <div class="ww-cookie-actions">
            <button type="button" class="ww-btn ww-btn--ghost" data-action="customize">Personalizar</button>
            <button type="button" class="ww-btn ww-btn--ghost" data-action="reject">Rechazar</button>
            <button type="button" class="ww-btn ww-btn--primary" data-action="accept">Aceptar todas</button>
        </div>
        <div class="ww-cookie-prefs" hidden>
            <div class="ww-cookie-prefs-row">
                <div>
                    <strong>Necesarias</strong>
                    <span>Sesión de juego e inicio de sesión. Siempre activas.</span>
                </div>
                <label class="ww-switch">
                    <input type="checkbox" checked disabled>
                    <span class="ww-switch-track"></span>
                </label>
            </div>
            <div class="ww-cookie-prefs-row">
                <div>
                    <strong>Analíticas</strong>
                    <span>Google Analytics: estadísticas de uso agregadas.</span>
                </div>
                <label class="ww-switch">
                    <input type="checkbox" id="ww-cookie-analytics-toggle">
                    <span class="ww-switch-track"></span>
                </label>
            </div>
            <button type="button" class="ww-btn ww-btn--primary" data-action="save">Guardar preferencias</button>
        </div>
    `;

    return banner;
}

function showBanner(): void {
    if (document.querySelector('.ww-cookie-banner')) return;

    const banner = buildBanner();
    document.body.appendChild(banner);

    const prefsPanel = banner.querySelector<HTMLElement>('.ww-cookie-prefs')!;
    const analyticsToggle = banner.querySelector<HTMLInputElement>('#ww-cookie-analytics-toggle')!;

    const close = () => banner.remove();

    banner.querySelector('[data-action="accept"]')?.addEventListener('click', () => {
        storeConsent(true);
        close();
    });

    banner.querySelector('[data-action="reject"]')?.addEventListener('click', () => {
        storeConsent(false);
        close();
    });

    banner.querySelector('[data-action="customize"]')?.addEventListener('click', () => {
        prefsPanel.hidden = !prefsPanel.hidden;
    });

    banner.querySelector('[data-action="save"]')?.addEventListener('click', () => {
        storeConsent(analyticsToggle.checked);
        close();
    });
}

export function initCookieConsent(): void {
    const consent = getStoredConsent();

    if (!consent) {
        showBanner();
        return;
    }

    if (consent.analytics) {
        loadAnalytics();
    }
}

// Permite reabrir el banner desde cualquier enlace con [data-cookie-settings]
document.addEventListener('click', (e) => {
    const target = (e.target as HTMLElement).closest('[data-cookie-settings]');
    if (target) {
        e.preventDefault();
        showBanner();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCookieConsent);
} else {
    initCookieConsent();
}
