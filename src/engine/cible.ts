/**
 * Recherche inverse : partir d'une rune voulue et trouver les objets à briser
 * pour l'obtenir.
 *
 * Pour chaque objet portant la caractéristique de la rune, on calcule ce que
 * rend un brisage focalisé sur cette ligne (le focus maximise la rune ciblée)
 * et, si un coût d'acquisition est connu, le prix de revient d'une rune.
 */
import type { StatId } from '../data/statMapping.ts';
import type { Item, Monstre, RuneDef } from '../data/types.ts';
import { calculerPoints } from './brisage.ts';
import { lignesDepuisItem, type JetChoisi } from './explorateur.ts';
import type { Contexte } from './types.ts';

export type SourceDrop = { monstre: Monstre; taux: number };

export type PisteRune = {
  item: Item;
  /** Jet retenu sur la ligne ciblée (selon le mode de jet). */
  jet: number;
  /** Points de la caractéristique restitués, focus sur la ligne ciblée. */
  pointsFocus: number;
  /** Points restitués en brisage naturel (sans focus). */
  pointsNaturel: number;
  /** Nombre de runes ciblées obtenues avec focus (décimales = probabilité). */
  quantiteFocus: number;
  quantiteNaturel: number;
  /** Valeur des runes ciblées au prix renseigné, focus. */
  valeurFocus: number;
  /** Coût d'acquisition connu (HDV ou craft), sinon `null`. */
  cout: number | null;
  /** Coût de revient d'une rune ciblée, sinon `null`. */
  coutParRune: number | null;
  /** Monstres qui lâchent l'objet, taux décroissant. */
  drops: SourceDrop[];
  craftable: boolean;
};

export type OptionsCible = {
  coefficient: number;
  jet: JetChoisi;
  /** Niveau maximum des objets retenus. */
  niveauMax?: number;
  /** Coût d'acquisition par objet (prix HDV ou craft déjà arbitré). */
  couts?: Readonly<Record<number, number>>;
  /** Prospection, pour ajuster les taux de drop affichés. */
  prospection?: number;
};

/** Index itemId → monstres qui le lâchent (taux décroissant). */
export function indexerDrops(monstres: readonly Monstre[], prospection = 100): Map<number, SourceDrop[]> {
  const out = new Map<number, SourceDrop[]>();
  const facteur = Math.max(0, prospection) / 100;
  for (const m of monstres) {
    for (const d of m.drops) {
      const liste = out.get(d.itemId) ?? [];
      liste.push({ monstre: m, taux: Math.min(100, d.taux * facteur) });
      out.set(d.itemId, liste);
    }
  }
  for (const liste of out.values()) liste.sort((a, b) => b.taux - a.taux);
  return out;
}

/**
 * Objets permettant d'obtenir la rune visée, du plus généreux au moins généreux.
 * `rune.valeur` convertit les points en nombre de runes (Rune Vi = 5 points…).
 */
export function ciblerRune(
  rune: RuneDef,
  items: readonly Item[],
  ctx: Contexte,
  options: OptionsCible,
  monstres: readonly Monstre[] = [],
): PisteRune[] {
  const statId: StatId = rune.statId;
  const parDrop = indexerDrops(monstres, options.prospection ?? 100);
  const prixRune = ctx.prix[rune.id];
  const pistes: PisteRune[] = [];

  for (const item of items) {
    if (item.nonBrisable || item.niveau > (options.niveauMax ?? Infinity)) continue;
    const lignes = lignesDepuisItem(item, options.jet);
    const ciblees = lignes.filter((l) => l.statId === statId && l.jet > 0);
    if (ciblees.length === 0) continue;

    const base = { niveau: item.niveau, lignes, coefficient: options.coefficient };
    const pointsFocus = calculerPoints({ ...base, focus: statId }, ctx.poids)[statId] ?? 0;
    const pointsNaturel = calculerPoints({ ...base, focus: null }, ctx.poids)[statId] ?? 0;
    if (pointsFocus <= 0 && pointsNaturel <= 0) continue;

    const quantiteFocus = pointsFocus / rune.valeur;
    const cout = options.couts?.[item.id] ?? null;
    pistes.push({
      item,
      jet: ciblees.reduce((s, l) => s + l.jet, 0),
      pointsFocus,
      pointsNaturel,
      quantiteFocus,
      quantiteNaturel: pointsNaturel / rune.valeur,
      valeurFocus: quantiteFocus * (prixRune ?? 0),
      cout,
      coutParRune: cout !== null && quantiteFocus > 0 ? cout / quantiteFocus : null,
      drops: parDrop.get(item.id) ?? [],
      craftable: item.recetteConnue === true,
    });
  }

  return pistes.sort((a, b) => b.quantiteFocus - a.quantiteFocus);
}
