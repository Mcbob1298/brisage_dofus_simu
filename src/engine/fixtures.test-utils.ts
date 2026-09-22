/** Jeu de runes minimal et réaliste pour les tests (valeurs identiques à runes.json). */
import type { RuneDef, RuneTier } from '../data/types.ts';
import type { StatId } from '../data/statMapping.ts';
import type { Contexte, ModeRepartition, PrixRunes } from './types.ts';
import { POIDS_DEFAUT } from './poids.ts';

let nextId = 1;
function rune(statId: StatId, tier: RuneTier, valeur: number, nom: string): RuneDef {
  return { id: nextId++, nom, statId, tier, valeur, imageLocale: '' };
}

export const RUNES_TEST: RuneDef[] = [
  rune('pctCritique', 'simple', 1, 'Rune Cri'),
  rune('force', 'simple', 1, 'Rune Fo'),
  rune('force', 'pa', 3, 'Rune Pa Fo'),
  rune('force', 'ra', 10, 'Rune Ra Fo'),
  rune('vitalite', 'simple', 5, 'Rune Vi'),
  rune('vitalite', 'pa', 15, 'Rune Pa Vi'),
  rune('vitalite', 'ra', 50, 'Rune Ra Vi'),
  rune('sagesse', 'simple', 1, 'Rune Sa'),
  rune('sagesse', 'pa', 3, 'Rune Pa Sa'),
  rune('sagesse', 'ra', 10, 'Rune Ra Sa'),
  rune('intelligence', 'simple', 1, 'Rune Ine'),
  rune('intelligence', 'pa', 3, 'Rune Pa Ine'),
  rune('intelligence', 'ra', 10, 'Rune Ra Ine'),
  rune('pa', 'simple', 1, 'Rune Ga Pa'),
  rune('initiative', 'simple', 10, 'Rune Ini'),
  rune('initiative', 'pa', 30, 'Rune Pa Ini'),
  rune('initiative', 'ra', 100, 'Rune Ra Ini'),
];

export function runeParNom(nom: string): RuneDef {
  const r = RUNES_TEST.find((x) => x.nom === nom);
  if (!r) throw new Error(`rune de test inconnue : ${nom}`);
  return r;
}

export function runesDe(statId: StatId): RuneDef[] {
  return RUNES_TEST.filter((r) => r.statId === statId);
}

/** Prix « cohérents » : Pa = 3× simple, Ra = 10× simple, sauf mention contraire. */
export function prixTest(overrides: Record<string, number> = {}): PrixRunes {
  const base: Record<string, number> = {
    'Rune Cri': 1000,
    'Rune Fo': 100,
    'Rune Pa Fo': 300,
    'Rune Ra Fo': 1000,
    'Rune Vi': 50,
    'Rune Pa Vi': 150,
    'Rune Ra Vi': 500,
    'Rune Sa': 200,
    'Rune Pa Sa': 600,
    'Rune Ra Sa': 2000,
    'Rune Ine': 100,
    'Rune Pa Ine': 300,
    'Rune Ra Ine': 1000,
    'Rune Ga Pa': 50000,
    'Rune Ini': 10,
    'Rune Pa Ini': 30,
    'Rune Ra Ini': 100,
  };
  const prix: Partial<Record<number, number>> = {};
  for (const [nom, p] of Object.entries({ ...base, ...overrides })) prix[runeParNom(nom).id] = p;
  return prix;
}

export function contexte(mode: ModeRepartition = 'greedy', prix: PrixRunes = prixTest()): Contexte {
  return { poids: POIDS_DEFAUT, runes: RUNES_TEST, prix, mode };
}
