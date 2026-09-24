/**
 * Évaluation de tout le catalogue à coefficient 100 % : valeur espérée des
 * runes en brisage naturel et au meilleur focus. Pas de bilan ni de seuil ici
 * (trop coûteux sur des milliers d'objets, et le prix d'achat n'est pas connu).
 */
import type { Item } from '../data/types.ts';
import type { StatId } from '../data/statMapping.ts';
import { calculerBrisage } from './brisage.ts';
import type { Contexte, EntreeBrisage, LigneBrisage } from './types.ts';

export type JetChoisi = 'min' | 'moyen' | 'max';

export type EvaluationItem = {
  item: Item;
  /** Valeur espérée brute des runes, brisage naturel, coef 100 %. */
  valeurNaturel: number;
  /** Meilleure stratégie : `null` = naturel. */
  meilleurFocus: StatId | null;
  /** Valeur espérée brute au meilleur focus (= valeurNaturel si naturel gagne). */
  valeurMeilleure: number;
  /** Au moins une rune produite n'a pas de prix (valeur sous-estimée). */
  prixManquants: boolean;
};

export function lignesDepuisItem(item: Item, jet: JetChoisi): LigneBrisage[] {
  return item.stats.map((s) => ({
    statId: s.statId,
    jet: jet === 'min' ? s.min : jet === 'max' ? s.max : Math.round((s.min + s.max) / 2),
  }));
}

export function evaluerItem(item: Item, ctx: Contexte, jet: JetChoisi = 'max', coefficient = 100): EvaluationItem {
  // Le concasseur refuse les objets liés ou de quête : ils ne valent aucune rune.
  if (item.nonBrisable) {
    return { item, valeurNaturel: 0, meilleurFocus: null, valeurMeilleure: 0, prixManquants: false };
  }
  const lignes = lignesDepuisItem(item, jet);
  const base: EntreeBrisage = { niveau: item.niveau, lignes, coefficient, focus: null };
  const naturel = calculerBrisage(base, ctx);
  let meilleurFocus: StatId | null = null;
  let valeurMeilleure = naturel.valeurEsperee;
  let prixManquants = naturel.prixManquants.length > 0;
  const vus = new Set<StatId>();
  for (const l of lignes) {
    if (l.jet <= 0 || vus.has(l.statId)) continue;
    vus.add(l.statId);
    const r = calculerBrisage({ ...base, focus: l.statId }, ctx);
    if (r.valeurEsperee > valeurMeilleure) {
      valeurMeilleure = r.valeurEsperee;
      meilleurFocus = l.statId;
      prixManquants = r.prixManquants.length > 0;
    }
  }
  return { item, valeurNaturel: naturel.valeurEsperee, meilleurFocus, valeurMeilleure, prixManquants };
}

export function evaluerCatalogue(items: readonly Item[], ctx: Contexte, jet: JetChoisi = 'max'): EvaluationItem[] {
  return items.filter((it) => !it.nonBrisable).map((it) => evaluerItem(it, ctx, jet));
}
