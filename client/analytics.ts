// Carga Google Analytics 4 de forma perezosa y solo cuando el usuario ha dado su consentimiento.
// Sustituye GA_MEASUREMENT_ID por tu ID real (formato "G-XXXXXXXXXX") cuando lo tengas.
export const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX';

let loaded = false;

export function loadAnalytics(measurementId: string = GA_MEASUREMENT_ID): void {
    if (loaded || !measurementId || measurementId === 'G-XXXXXXXXXX') {
        if (measurementId === 'G-XXXXXXXXXX') {
            console.info('[WordWars] Analítica no configurada: define un GA_MEASUREMENT_ID real en client/analytics.ts');
        }
        return;
    }
    loaded = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);

    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) {
        (window as any).dataLayer.push(args);
    }
    (window as any).gtag = gtag;
    gtag('js', new Date());
    gtag('config', measurementId, { anonymize_ip: true });
}
