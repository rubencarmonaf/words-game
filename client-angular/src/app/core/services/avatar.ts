import { Service } from '@angular/core';
import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import type { AvatarOptions } from '@shared-types';
import {
  AVATAR_TOP_OPTIONS,
  AVATAR_HAIR_COLORS,
  AVATAR_SKIN_COLORS,
  AVATAR_EYES_OPTIONS,
  AVATAR_EYEBROWS_OPTIONS,
  AVATAR_MOUTH_OPTIONS,
  AVATAR_FACIAL_HAIR_OPTIONS,
  AVATAR_ACCESSORIES_OPTIONS,
  AVATAR_CLOTHING_OPTIONS,
  AVATAR_CLOTHES_COLORS,
  AVATAR_BACKGROUND_COLORS,
} from '@shared-types';

export interface AvatarCategory {
  field: keyof AvatarOptions;
  label: string;
  kind: 'color' | 'shape';
  options: readonly string[];
  /** Etiqueta accesible para la opción "ninguno" (solo campos opcionales) */
  noneLabel?: string;
}

export const AVATAR_CATEGORIES: AvatarCategory[] = [
  { field: 'top', label: 'Pelo', kind: 'shape', options: AVATAR_TOP_OPTIONS },
  { field: 'hairColor', label: 'Color de pelo', kind: 'color', options: AVATAR_HAIR_COLORS },
  { field: 'skinColor', label: 'Piel', kind: 'color', options: AVATAR_SKIN_COLORS },
  { field: 'eyes', label: 'Ojos', kind: 'shape', options: AVATAR_EYES_OPTIONS },
  { field: 'eyebrows', label: 'Cejas', kind: 'shape', options: AVATAR_EYEBROWS_OPTIONS },
  { field: 'mouth', label: 'Boca', kind: 'shape', options: AVATAR_MOUTH_OPTIONS },
  {
    field: 'facialHair',
    label: 'Vello facial',
    kind: 'shape',
    options: AVATAR_FACIAL_HAIR_OPTIONS,
    noneLabel: 'Sin vello',
  },
  {
    field: 'accessories',
    label: 'Gafas',
    kind: 'shape',
    options: AVATAR_ACCESSORIES_OPTIONS,
    noneLabel: 'Sin gafas',
  },
  { field: 'clothing', label: 'Ropa', kind: 'shape', options: AVATAR_CLOTHING_OPTIONS },
  { field: 'clothesColor', label: 'Color de ropa', kind: 'color', options: AVATAR_CLOTHES_COLORS },
  { field: 'backgroundColor', label: 'Fondo', kind: 'color', options: AVATAR_BACKGROUND_COLORS },
];

// Agrupación de alto nivel para el editor: 4 pestañas en vez de 11, cada una
// con sus subcategorías apiladas verticalmente (scroll normal, no horizontal).
export interface AvatarGroup {
  key: string;
  label: string;
  fields: (keyof AvatarOptions)[];
}

export const AVATAR_GROUPS: AvatarGroup[] = [
  { key: 'face', label: 'Cara', fields: ['skinColor', 'eyes', 'eyebrows', 'mouth', 'facialHair'] },
  { key: 'hair', label: 'Pelo', fields: ['top', 'hairColor'] },
  { key: 'style', label: 'Estilo', fields: ['accessories', 'clothing', 'clothesColor'] },
  { key: 'background', label: 'Fondo', fields: ['backgroundColor'] },
];

@Service()
export class Avatar {
  readonly categories = AVATAR_CATEGORIES;
  readonly groups = AVATAR_GROUPS;

  // Genera el SVG completo del avatar a partir de sus opciones. Cada rasgo se
  // fija con un array de un único valor (en vez de dejar que DiceBear elija al
  // azar dentro de una lista) para que el resultado sea 100% el que el
  // jugador eligió, no una variación aleatoria basada en la seed.
  renderSvg(options: AvatarOptions): string {
    const avatar = createAvatar(avataaars as any, {
      seed: 'wordwars',
      top: [options.top],
      topProbability: 100,
      hairColor: [options.hairColor],
      skinColor: [options.skinColor],
      eyes: [options.eyes],
      eyebrows: [options.eyebrows],
      mouth: [options.mouth],
      facialHair: options.facialHair ? [options.facialHair] : undefined,
      facialHairProbability: options.facialHair ? 100 : 0,
      accessories: options.accessories ? [options.accessories] : undefined,
      accessoriesProbability: options.accessories ? 100 : 0,
      clothing: [options.clothing],
      clothesColor: [options.clothesColor],
      backgroundColor: [options.backgroundColor],
    });

    return avatar.toString();
  }

  // Miniatura para el picker: parte de las opciones actuales y varía un único
  // campo, para previsualizar "cómo quedaría" sin perder el resto del look.
  renderPreview(base: AvatarOptions, field: keyof AvatarOptions, value: string): string {
    return this.renderSvg({ ...base, [field]: value });
  }
}
