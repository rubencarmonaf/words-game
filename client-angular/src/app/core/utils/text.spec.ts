import { stripAccents } from './text';

describe('stripAccents', () => {
  it('removes the acute accent from vowels', () => {
    expect(stripAccents('camión')).toBe('camion');
    expect(stripAccents('árbol')).toBe('arbol');
    expect(stripAccents('canción')).toBe('cancion');
  });

  it('leaves words without accents untouched', () => {
    expect(stripAccents('invierno')).toBe('invierno');
  });

  it('does not touch ñ: it is a different letter, not an accented n', () => {
    expect(stripAccents('año')).toBe('año');
    expect(stripAccents('ñu')).toBe('ñu');
  });

  it('does not touch the diaeresis on ü', () => {
    expect(stripAccents('pingüino')).toBe('pingüino');
  });

  it('matches accented and unaccented spellings of the same word', () => {
    expect(stripAccents('camión')).toBe(stripAccents('camion'));
  });
});
