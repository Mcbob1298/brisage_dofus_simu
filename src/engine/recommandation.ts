/**
 * Que briser maintenant, compte tenu de la somme dont on dispose.
 *
 * On ne travaille qu'avec des coûts relevés à la main : un prix inventé
 * donnerait une recommandation inventée. Pour chaque objet chiffré, on calcule
 * le bénéfice d'un brisage (meilleure stratégie : naturel ou focus), combien le
 * budget en permet, et donc le gain total de l'opération.
 */
import type { StatId } from '../data/statMapping.ts';
import type { Item } from '../data/types.ts';
import { calculerBrisage, coefficientSeuil } from './brisage.ts';
import { lignesDepuisItem, type JetChoisi } from './explorateur.ts';
import type { Contexte } from './types.ts';

export type SourceCout = 'hdv' | 'craft';

export type Opportunite = {
  item: Item;
  source: SourceCout;
  /** Coût d'acquisition d'un exemplaire. */
  cout: number;
  /** Valeur des runes, taxe déduite, au coefficient retenu. */
  valeurNette: number;
  /** Bénéfice sur un objet. */
  benefice: number;
  /** Retour sur investissement, en %. */
  roi: number;
  /** Stratégie retenue : `null` pour un brisage naturel. */
  focus: StatId | null;
  /** Exemplaires que le budget permet d'acheter. */
  quantite: number;
  /** Bénéfice de l'opération complète, budget épuisé. */
  beneficeTotal: number;
  /** Coefficient minimal pour que l'objet reste rentable à ce prix. */
  seuil: number | null;
};

export type OptionsRecommandation = {
  /** Somme que l'on accepte d'engager, en kamas. */
  budget: number;
  coefficient: number;
  taxePct: number;
  jet: JetChoisi;
  /** Coûts relevés, par id d'objet. */
  couts: ReadonlyMap<number, { prix: number; source: SourceCout }>;
  /** Marge minimale exigée, en % (0 = tout ce qui est rentable). */
  roiMin?: number;
};

/**
 * Opportunités classées par gain total : ce que le budget peut réellement
 * rapporter, pas seulement la marge unitaire. Un petit objet très rentable
 * qu'on peut acheter cent fois passe donc devant une grosse pièce unique.
 */
export function recommanderBrisage(items: readonly Item[], ctx: Contexte, options: OptionsRecommandation): Opportunite[] {
  const facteurNet = 1 - options.taxePct / 100;
  const roiMin = options.roiMin ?? 0;
  const out: Opportunite[] = [];

  for (const item of items) {
    const cout = options.couts.get(item.id);
    if (!cout || cout.prix <= 0 || item.nonBrisable || item.stats.length === 0) continue;

    const lignes = lignesDepuisItem(item, options.jet);
    const base = { niveau: item.niveau, lignes, coefficient: options.coefficient };
    let focus: StatId | null = null;
    let valeur = calculerBrisage({ ...base, focus: null }, ctx).valeurEsperee;
    const vus = new Set<StatId>();
    for (const l of lignes) {
      if (l.jet <= 0 || vus.has(l.statId)) continue;
      vus.add(l.statId);
      const v = calculerBrisage({ ...base, focus: l.statId }, ctx).valeurEsperee;
      if (v > valeur) {
        valeur = v;
        focus = l.statId;
      }
    }

    const valeurNette = valeur * facteurNet;
    const benefice = valeurNette - cout.prix;
    const roi = (benefice / cout.prix) * 100;
    if (benefice <= 0 || roi < roiMin) continue;

    const quantite = Math.floor(options.budget / cout.prix);
    out.push({
      item,
      source: cout.source,
      cout: cout.prix,
      valeurNette,
      benefice,
      roi,
      focus,
      quantite,
      beneficeTotal: quantite * benefice,
      seuil: coefficientSeuil({ niveau: item.niveau, lignes, focus }, ctx, { prixRevient: cout.prix, taxePct: options.taxePct, nbObjets: 1 }),
    });
  }

  return out.sort((a, b) => b.beneficeTotal - a.beneficeTotal || b.roi - a.roi);
}
