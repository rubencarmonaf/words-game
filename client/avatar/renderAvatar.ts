import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import { AvatarOptions } from '../../src/types';

// Genera el SVG completo del avatar a partir de sus opciones. Cada rasgo se
// fija con un array de un único valor (en vez de dejar que DiceBear elija al
// azar dentro de una lista) para que el resultado sea 100% el que el jugador
// eligió, no una variación aleatoria basada en la seed.
export function renderAvatarSvg(options: AvatarOptions): string {
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
        backgroundColor: [options.backgroundColor]
    });

    return avatar.toString();
}

// Miniatura para un picker: parte de las opciones actuales y varía un único
// campo, para previsualizar "cómo quedaría" sin perder el resto del look.
export function renderAvatarPreview(base: AvatarOptions, field: keyof AvatarOptions, value: string): string {
    return renderAvatarSvg({ ...base, [field]: value });
}
