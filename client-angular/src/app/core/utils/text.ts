/**
 * Quita solo la tilde de las vocales (á é í ó ú → a e i o u). Deja intactas la ñ y la diéresis
 * de la ü: son letras distintas, no una vocal acentuada. Debe coincidir con la misma función en
 * src/utils/text.ts (servidor) — sirve para comprobar el prefijo exigido y las palabras
 * repetidas antes de mandar nada al servidor, sin depender de si se escribieron los acentos.
 */
export function stripAccents(word: string): string {
  return word.normalize('NFD').replace(/́/g, '').normalize('NFC');
}
