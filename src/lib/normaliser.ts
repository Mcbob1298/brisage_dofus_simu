/** Minuscules, sans accents, sans ponctuation : « Épée de l'Ébène » → « epee de l ebene ». */
export function normaliser(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
