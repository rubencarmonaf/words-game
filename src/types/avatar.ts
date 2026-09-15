// Opciones de avatar tipo "muñeco de vestir" (estilo avataaars de DiceBear).
// Única fuente de verdad para cliente (render + selector) y servidor (validación).

export interface AvatarOptions {
  top: string;
  hairColor: string;
  skinColor: string;
  eyes: string;
  eyebrows: string;
  mouth: string;
  facialHair: string; // '' = sin vello facial
  accessories: string; // '' = sin gafas
  clothing: string;
  clothesColor: string;
  backgroundColor: string;
}

export const AVATAR_TOP_OPTIONS = [
  'bigHair', 'bob', 'bun', 'curly', 'curvy', 'dreads01', 'fro', 'froBand',
  'longButNotTooLong', 'miaWallace', 'shaggyMullet', 'shavedSides',
  'shortFlat', 'straight02', 'theCaesar', 'turban', 'hat'
] as const;

export const AVATAR_HAIR_COLORS = [
  'a55728', '2c1b18', 'b58143', 'd6b370', '724133', '4a312c', 'f59797', 'ecdcbf', 'c93305', 'e8e1e1'
] as const;

export const AVATAR_SKIN_COLORS = [
  '614335', 'd08b5b', 'ae5d29', 'edb98a', 'ffdbb4', 'fd9841', 'f8d25c'
] as const;

export const AVATAR_EYES_OPTIONS = [
  'default', 'happy', 'side', 'squint', 'surprised', 'wink', 'winkWacky', 'hearts', 'xDizzy', 'closed', 'cry', 'eyeRoll'
] as const;

export const AVATAR_EYEBROWS_OPTIONS = [
  'defaultNatural', 'angryNatural', 'flatNatural', 'raisedExcitedNatural', 'sadConcernedNatural', 'unibrowNatural', 'upDownNatural'
] as const;

export const AVATAR_MOUTH_OPTIONS = [
  'smile', 'default', 'twinkle', 'serious', 'disbelief', 'eating', 'grimace', 'sad', 'screamOpen', 'concerned', 'tongue', 'vomit'
] as const;

export const AVATAR_FACIAL_HAIR_OPTIONS = [
  '', 'beardLight', 'beardMedium', 'beardMajestic', 'moustacheFancy', 'moustacheMagnum'
] as const;

export const AVATAR_ACCESSORIES_OPTIONS = [
  '', 'round', 'prescription01', 'prescription02', 'sunglasses', 'wayfarers', 'kurt', 'eyepatch'
] as const;

export const AVATAR_CLOTHING_OPTIONS = [
  'hoodie', 'blazerAndShirt', 'blazerAndSweater', 'collarAndSweater', 'graphicShirt', 'overall', 'shirtCrewNeck', 'shirtScoopNeck', 'shirtVNeck'
] as const;

export const AVATAR_CLOTHES_COLORS = [
  '3c4f5c', '262e33', '65c9ff', '5199e4', '25557c', 'e6e6e6', '929598', 'b1e2ff', 'a7ffc4', 'ffafb9', 'ffffb1', 'ff488e', 'ff5c5c', 'ffffff'
] as const;

// Restringido a los 4 colores de línea de la app, para que el avatar siga
// hablando el mismo idioma visual que el resto de WordWars.
export const AVATAR_BACKGROUND_COLORS = ['4a90e2', 'cc3f52', 'f5a623', '5fd97a'] as const;

export const DEFAULT_AVATAR: AvatarOptions = {
  top: 'shortFlat',
  hairColor: '2c1b18',
  skinColor: 'edb98a',
  eyes: 'default',
  eyebrows: 'defaultNatural',
  mouth: 'smile',
  facialHair: '',
  accessories: '',
  clothing: 'hoodie',
  clothesColor: '3c4f5c',
  backgroundColor: '4a90e2'
};

const FIELD_OPTIONS: Record<keyof AvatarOptions, readonly string[]> = {
  top: AVATAR_TOP_OPTIONS,
  hairColor: AVATAR_HAIR_COLORS,
  skinColor: AVATAR_SKIN_COLORS,
  eyes: AVATAR_EYES_OPTIONS,
  eyebrows: AVATAR_EYEBROWS_OPTIONS,
  mouth: AVATAR_MOUTH_OPTIONS,
  facialHair: AVATAR_FACIAL_HAIR_OPTIONS,
  accessories: AVATAR_ACCESSORIES_OPTIONS,
  clothing: AVATAR_CLOTHING_OPTIONS,
  clothesColor: AVATAR_CLOTHES_COLORS,
  backgroundColor: AVATAR_BACKGROUND_COLORS
};

export function sanitizeAvatarOptions(input: any): AvatarOptions {
  const result = { ...DEFAULT_AVATAR };
  if (!input || typeof input !== 'object') return result;

  (Object.keys(FIELD_OPTIONS) as (keyof AvatarOptions)[]).forEach((field) => {
    const value = input[field];
    if (typeof value === 'string' && (FIELD_OPTIONS[field] as readonly string[]).includes(value)) {
      result[field] = value;
    }
  });

  return result;
}
