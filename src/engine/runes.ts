/**
 * Conversion des points de caractéristique en runes.
 *
 * Les dénominations disponibles (simple / Pa / Ra) et leur valeur en points
 * viennent de `runes.json` (objets réels du jeu), pas d'une table inventée :
 * Rune Fo = 1, Pa Fo = 3, Ra Fo = 10 ; Rune Vi = 5, Pa Vi = 15, Ra Vi = 50…
 */
import type { RuneDef } from '../data/types.ts';
import type { ModeRepartition, PrixRunes, RuneObtenue } from './types.ts';

export type Repartition = {
  runes: RuneObtenue[];
  /** Fraction d'une rune simple restante (0 ≤ x < 1) — probabilité d'une rune de plus. */
  reste: number;
  runeReste: RuneDef | null;
};

/** Petite marge pour éviter que 9.999999 tombe à 9 runes à cause des flottants. */
const EPSILON = 1e-9;

function trouverSimple(runesStat: readonly RuneDef[]): RuneDef | null {
  return runesStat.find((r) => r.tier === 'simple') ?? null;
}

/**
 * Répartit `points` en runes selon le mode choisi.
 * `runesStat` : les runes existantes pour la stat concernée (0 à 3 dénominations).
 */
export function repartirRunes(
  points: number,
  runesStat: readonly RuneDef[],
  mode: ModeRepartition,
  prix: PrixRunes,
): Repartition {
  const simple = trouverSimple(runesStat);
  if (!simple || !(points > 0)) {
    return { runes: [], reste: 0, runeReste: simple };
  }

  // Tout est exprimé en « unités » = nombre de runes simples équivalentes.
  const unitesTotales = points / simple.valeur + EPSILON;
  const unitesEntieres = Math.floor(unitesTotales);
  const brut = unitesTotales - unitesEntieres - EPSILON;
  // Un reste < 1e-6 est du bruit flottant, pas une chance réelle.
  const reste = brut < 1e-6 ? 0 : Math.min(1 - 1e-6, brut);

  const denominations = runesStat
    .map((rune) => ({ rune, unites: Math.round(rune.valeur / simple.valeur) }))
    .filter((d) => d.unites >= 1)
    .sort((a, b) => b.unites - a.unites);

  let quantites: Map<RuneDef, number>;
  switch (mode) {
    case 'toutSimple':
      quantites = new Map([[simple, unitesEntieres]]);
      break;
    case 'greedy':
      quantites = greedy(unitesEntieres, denominations);
      break;
    case 'valeurMax':
      quantites = valeurMax(unitesEntieres, denominations, prix);
      break;
  }

  const runes: RuneObtenue[] = [];
  for (const d of denominations) {
    const q = quantites.get(d.rune) ?? 0;
    if (q > 0) runes.push({ rune: d.rune, quantite: q, prixUnitaire: prix[d.rune.id] });
  }
  return { runes, reste, runeReste: simple };
}

type Denomination = { rune: RuneDef; unites: number };

/** Ra, puis Pa, puis simples — `denominations` est trié par valeur décroissante. */
function greedy(unites: number, denominations: Denomination[]): Map<RuneDef, number> {
  const out = new Map<RuneDef, number>();
  let restant = unites;
  for (const d of denominations) {
    const q = Math.floor(restant / d.unites);
    if (q > 0) out.set(d.rune, q);
    restant -= q * d.unites;
  }
  return out;
}

/**
 * Sac-à-dos non borné : maximise la valeur en kamas des `unites` disponibles.
 * Une rune sans prix vaut 0. Borne haute théorique, pas le comportement du jeu.
 */
function valeurMax(unites: number, denominations: Denomination[], prix: PrixRunes): Map<RuneDef, number> {
  const meilleur = new Float64Array(unites + 1);
  const choix = new Int32Array(unites + 1).fill(-1);
  for (let u = 1; u <= unites; u++) {
    for (let i = 0; i < denominations.length; i++) {
      const d = denominations[i];
      if (d.unites > u) continue;
      const v = meilleur[u - d.unites] + (prix[d.rune.id] ?? 0);
      if (v > meilleur[u] || choix[u] === -1) {
        meilleur[u] = v;
        choix[u] = i;
      }
    }
  }
  const out = new Map<RuneDef, number>();
  for (let u = unites; u > 0; ) {
    const d = denominations[choix[u]];
    out.set(d.rune, (out.get(d.rune) ?? 0) + 1);
    u -= d.unites;
  }
  return out;
}
