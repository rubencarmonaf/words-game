/**
 * Quita solo la tilde de las vocales (á é í ó ú → a e i o u). Deja intactas la ñ y la diéresis
 * de la ü: son letras distintas, no una vocal acentuada, así que "año" y "ano" no deben
 * confundirse por esto. Sirve para que la validación de palabras, el prefijo exigido y la
 * comprobación de palabras repetidas no dependan de si el jugador escribió los acentos.
 */
export function stripAccents(word: string): string {
  // NFD separa la letra de su tilde en dos puntos de código (á -> a + U+0301); ñ y ü usan otras
  // marcas (U+0303 y U+0308), así que solo se quita U+0301 y no les afecta.
  return word.normalize('NFD').replace(/́/g, '').normalize('NFC');
}
