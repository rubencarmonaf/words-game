import { ELO_TIERS, eloTier } from './elo-tier';

describe('eloTier', () => {
  it('has six tiers, in ascending order of ELO', () => {
    expect(ELO_TIERS.map((t) => t.name)).toEqual(['Aprendiz', 'Aficionado', 'Experto', 'Maestro', 'Leyenda', 'Mítico']);
    const mins = ELO_TIERS.map((t) => t.min);
    expect(mins).toEqual([...mins].sort((a, b) => a - b));
  });

  it('bands are contiguous: each tier starts where the previous one ends, and only the last is open-ended', () => {
    ELO_TIERS.forEach((tier, i) => {
      if (i > 0) expect(tier.min).toBe(ELO_TIERS[i - 1].max);
    });
    expect(ELO_TIERS.filter((t) => t.max === null).length).toBe(1);
    expect(ELO_TIERS[ELO_TIERS.length - 1].max).toBeNull();
  });

  it('picks the right tier at every boundary', () => {
    expect(eloTier(0).name).toBe('Aprendiz');
    expect(eloTier(499).name).toBe('Aprendiz');
    expect(eloTier(500).name).toBe('Aficionado');
    expect(eloTier(999).name).toBe('Aficionado');
    expect(eloTier(1000).name).toBe('Experto');
    expect(eloTier(1499).name).toBe('Experto');
    expect(eloTier(1500).name).toBe('Maestro');
    expect(eloTier(1999).name).toBe('Maestro');
    expect(eloTier(2000).name).toBe('Leyenda');
    expect(eloTier(2499).name).toBe('Leyenda');
    expect(eloTier(2500).name).toBe('Mítico');
    expect(eloTier(9999).name).toBe('Mítico');
  });

  it('gives every tier its own emblem image', () => {
    const images = ELO_TIERS.map((t) => t.image);
    expect(new Set(images).size).toBe(images.length);
    for (const image of images) expect(image).toMatch(/^\/assets\/ranks\/[a-z]+\.png$/);
  });

  it('gives every tier its own color key', () => {
    const keys = ELO_TIERS.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
