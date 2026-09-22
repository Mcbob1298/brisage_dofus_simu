/**
 * Valeur de farm : ce que rapporte, en runes, un combat contre un monstre dont
 * on brise les équipements lâchés.
 *
 * Les taux viennent de DofusDB (`percentDropForGradeN`, identiques pour tous les
 * grades dans les données observées le 2026-09-22). Ils correspondent au taux de
 * base ; en jeu la prospection les module — la mise à l'échelle linéaire
 * (taux × pp / 100) est une approximation, elle est signalée comme telle dans
 * l'interface et vaut 1 par défaut.
 */
import type { Item, Monstre } from '../data/types.ts';
import type { Contexte } from './types.ts';
import { evaluerItem, type JetChoisi } from './explorateur.ts';

export type DropEvalue = {
  item: Item;
  /** Taux effectif en %, prospection appliquée, plafonné à 100. */
  taux: number;
  /** Valeur espérée des runes de l'objet (meilleure stratégie, coef donné). */
  valeurObjet: number;
  /** Contribution au gain d'un combat : taux/100 × valeur. */
  valeurParCombat: number;
};

export type MonstreEvalue = {
  monstre: Monstre;
  drops: DropEvalue[];
  /** Somme des contributions : kamas de runes espérés par combat gagné. */
  valeurParCombat: number;
  /** Combats à enchaîner pour obtenir un objet, toutes cibles confondues. */
  combatsParObjet: number | null;
};

export type OptionsFarm = {
  niveauJoueur: number;
  /** Prospection du personnage (100 = taux de base). */
  prospection: number;
  /** Coefficient supposé au concasseur. */
  coefficient: number;
  /** Taxe de vente en %. */
  taxePct: number;
  /** Jets supposés des objets lâchés (moyens par défaut : un drop n'est pas un craft). */
  jet: JetChoisi;
  /** Écart de niveau toléré au-dessus du personnage. */
  ecartNiveauMax: number;
};

/** Un drop conditionné par le niveau du joueur (critère `PL`) n'est pris que si la condition est remplie. */
function dropAccessible(plMin: number | undefined, plMax: number | undefined, niveauJoueur: number): boolean {
  if (plMin !== undefined && niveauJoueur < plMin) return false;
  if (plMax !== undefined && niveauJoueur > plMax) return false;
  return true;
}

export function evaluerMonstre(
  monstre: Monstre,
  parId: ReadonlyMap<number, Item>,
  ctx: Contexte,
  options: OptionsFarm,
): MonstreEvalue {
  const facteurProspection = Math.max(0, options.prospection) / 100;
  const facteurNet = 1 - options.taxePct / 100;
  const drops: DropEvalue[] = [];
  let sommeTaux = 0;
  for (const d of monstre.drops) {
    if (!dropAccessible(d.plMin, d.plMax, options.niveauJoueur)) continue;
    const item = parId.get(d.itemId);
    if (!item || item.stats.length === 0) continue;
    const taux = Math.min(100, d.taux * facteurProspection);
    const ev = evaluerItem(item, ctx, options.jet, options.coefficient);
    const valeurObjet = ev.valeurMeilleure * facteurNet;
    drops.push({ item, taux, valeurObjet, valeurParCombat: (taux / 100) * valeurObjet });
    sommeTaux += taux;
  }
  drops.sort((a, b) => b.valeurParCombat - a.valeurParCombat);
  return {
    monstre,
    drops,
    valeurParCombat: drops.reduce((s, d) => s + d.valeurParCombat, 0),
    combatsParObjet: sommeTaux > 0 ? 100 / sommeTaux : null,
  };
}

export function evaluerFarm(
  monstres: readonly Monstre[],
  parId: ReadonlyMap<number, Item>,
  ctx: Contexte,
  options: OptionsFarm,
): MonstreEvalue[] {
  return monstres
    .filter((m) => m.niveau <= options.niveauJoueur + options.ecartNiveauMax)
    .map((m) => evaluerMonstre(m, parId, ctx, options))
    .filter((m) => m.drops.length > 0)
    .sort((a, b) => b.valeurParCombat - a.valeurParCombat);
}
