// Los tiers de ELO son la fuente del "nivel" del carnet de perfil — ningún
// dato inventado, reutilizan el mismo significado de color de línea que ya
// tienen los modos de juego. Bandas de 500 ELO: empezar en 0 hace que subir
// un tramo cueste ~17 victorias netas con K=60 (~30 puntos por victoria
// entre rivales iguales). Los cinco primeros usan un color de línea; el
// último (Mítico) usa la tinta porcelana del sistema, sin color propio.
export interface EloTier {
  key: 'cobalt' | 'lime' | 'amber' | 'scarlet' | 'violet' | 'porcelain';
  name: string;
  min: number;
  max: number | null;
  /** Insignia arcade (píxel-art) de este rango, en public/assets/ranks. */
  image: string;
}

export const ELO_TIERS: EloTier[] = [
  { key: 'cobalt', name: 'Aprendiz', min: 0, max: 500, image: '/assets/ranks/aprendiz.png' },
  { key: 'lime', name: 'Aficionado', min: 500, max: 1000, image: '/assets/ranks/aficionado.png' },
  { key: 'amber', name: 'Experto', min: 1000, max: 1500, image: '/assets/ranks/experto.png' },
  { key: 'scarlet', name: 'Maestro', min: 1500, max: 2000, image: '/assets/ranks/maestro.png' },
  { key: 'violet', name: 'Leyenda', min: 2000, max: 2500, image: '/assets/ranks/leyenda.png' },
  { key: 'porcelain', name: 'Mítico', min: 2500, max: null, image: '/assets/ranks/mitico.png' },
];

export function eloTier(elo: number): EloTier {
  return ELO_TIERS.find((t) => elo >= t.min && (t.max === null || elo < t.max)) ?? ELO_TIERS[0];
}
