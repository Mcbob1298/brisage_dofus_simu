/**
 * Garde-fou d'architecture : UNE seule source de prix d'objets dans l'app.
 *
 * Trois fois, une page a calculé ses prix dans son coin à partir des seules
 * saisies manuelles, en ignorant le relevé HDV : « Prix des objets » (65 objets
 * chiffrés au lieu de 3 008), puis « Cibler une rune » (prix « ≈ » estimés alors
 * que le vrai prix était connu), puis la liste des objets suivis. Chaque fois,
 * deux écrans affichaient des chiffres différents pour le même objet.
 *
 * Tout passe désormais par `useCouts` (saisies > relevé HDV, puis craft). Ce
 * test échoue si un fichier recombine les sources lui-même.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../', import.meta.url));
const AUTORISES = new Set(['hooks/useCouts.ts', 'store/notes.ts']);

function fichiers(dossier: string): string[] {
  return readdirSync(dossier).flatMap((nom) => {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) return fichiers(chemin);
    return /\.tsx?$/.test(nom) && !/\.test\.tsx?$/.test(nom) ? [chemin] : [];
  });
}

describe('source unique des prix d’objets', () => {
  it('seul useCouts combine saisies, relevé HDV et craft', () => {
    const fautifs = fichiers(SRC)
      .map((f) => relative(SRC, f).split(sep).join('/'))
      .filter((rel) => !AUTORISES.has(rel))
      .filter((rel) => readFileSync(join(SRC, rel), 'utf8').includes('coutRetenu('));
    expect(fautifs, 'utiliser useCouts() au lieu de coutRetenu()').toEqual([]);
  });
});
