import {
    AvatarOptions,
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
    AVATAR_BACKGROUND_COLORS
} from '../../src/types';

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
    { field: 'facialHair', label: 'Vello facial', kind: 'shape', options: AVATAR_FACIAL_HAIR_OPTIONS, noneLabel: 'Sin vello' },
    { field: 'accessories', label: 'Gafas', kind: 'shape', options: AVATAR_ACCESSORIES_OPTIONS, noneLabel: 'Sin gafas' },
    { field: 'clothing', label: 'Ropa', kind: 'shape', options: AVATAR_CLOTHING_OPTIONS },
    { field: 'clothesColor', label: 'Color de ropa', kind: 'color', options: AVATAR_CLOTHES_COLORS },
    { field: 'backgroundColor', label: 'Fondo', kind: 'color', options: AVATAR_BACKGROUND_COLORS }
];
