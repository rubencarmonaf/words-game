// Los tiers de ELO son la fuente del "nivel" del carnet de perfil — ningún
// dato inventado, reutilizan el mismo significado de color de línea que ya
// tienen los modos de juego. Bandas de 500 ELO: empezar en 0 hace que subir
// un tramo cueste ~17 victorias netas con K=60 (~30 puntos por victoria
// entre rivales iguales).
export interface EloTier {
  key: 'cobalt' | 'lime' | 'amber' | 'scarlet';
  name: string;
  min: number;
  max: number | null;
}

export const ELO_TIERS: EloTier[] = [
  { key: 'cobalt', name: 'Aprendiz', min: 0, max: 500 },
  { key: 'lime', name: 'Viajero', min: 500, max: 1000 },
  { key: 'amber', name: 'Experto', min: 1000, max: 1500 },
  { key: 'scarlet', name: 'Leyenda', min: 1500, max: null },
];

export function eloTier(elo: number): EloTier {
  return ELO_TIERS.find((t) => elo >= t.min && (t.max === null || elo < t.max)) ?? ELO_TIERS[0];
}
