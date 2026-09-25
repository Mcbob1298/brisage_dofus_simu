/**
 * Repères de stratégie tirés de l'expérience de joueurs, pas des données du jeu.
 * Ils sont présentés comme tels dans l'interface : ce sont des garde-fous, pas
 * des vérités mesurées.
 */
import type { Item } from '../data/types.ts';

/**
 * Au-delà de ce coefficient, mieux vaut briser par petits lots et revérifier :
 * un taux très haut retombe vite dès qu'on l'exploite.
 * Repère communautaire, pas une règle du jeu.
 */
export const COEF_VOLATIL = 150;

/** Lots conseillés avant de relire le coefficient quand il est très haut. */
export const LOT_PRUDENT = 10;

/**
 * Un objet qui donne des PA ou des PM est recherché par tous les joueurs : il
 * est brisé en masse, donc son coefficient est souvent écrasé. À l'inverse, un
 * objet aux caractéristiques banales est délaissé et garde un meilleur taux.
 * Repère communautaire, à confirmer par tes propres relevés.
 */
export function estRecherche(item: Item): boolean {
  return item.stats.some((s) => (s.statId === 'pa' || s.statId === 'pm') && s.max > 0);
}

/** Part du budget engagée par un exemplaire, en %. */
export function partDuBudget(cout: number, budget: number): number | null {
  return budget > 0 ? (cout / budget) * 100 : null;
}
