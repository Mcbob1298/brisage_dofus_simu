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
import { calculerBrisage, coefficientSeuil, focalisable } from './brisage.ts';
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
  /** Coefficient utilisé pour cet objet. */
  coefficient: number;
  /** Vrai si ce coefficient a été relevé au concasseur, faux s'il est supposé. */
  coefMesure: boolean;
  /** Exemplaires que le budget permet d'acheter. */
  quantite: number;
  /**
   * Plafond théorique si le coefficient tenait sur tout le budget. Il ne tient
   * pas : briser fait baisser le coefficient. À n'afficher que comme tel.
   */
  beneficeTotal: number;
  /**
   * Exemplaires à acheter MAINTENANT, avant de relire le coefficient. Plafonné
   * à la part de budget qu'on accepte de risquer : on sait que le coefficient
   * baisse à chaque brisage, on ignore à quelle vitesse, donc on n'engage pas
   * tout sur une mesure faite avant le premier coup.
   */
  lotTest: number;
  /** Ce que coûte ce premier lot. */
  coutLot: number;
  /** Ce que ce premier lot rapporte, au coefficient actuel. */
  beneficeLot: number;
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
  /**
   * Coefficients relevés au concasseur, par id d'objet. Ils priment sur
   * `coefficient`, qui ne sert que de repli pour les objets jamais testés.
   */
  coefficients?: ReadonlyMap<number, number>;
  /** Marge minimale exigée, en % (0 = tout ce qui est rentable). */
  roiMin?: number;
  /**
   * Part du budget qu'on accepte d'engager sur un premier lot, en %. Elle borne
   * `lotTest` et sert de base au classement.
   */
  partRisquePct?: number;
};

/**
 * Opportunités classées par gain que le budget permet d'atteindre. Comme
 * `beneficeTotal ≈ budget × roi / 100`, ce classement revient à trier par
 * rendement, en pénalisant au passage les objets dont on ne peut s'offrir qu'un
 * ou deux exemplaires (l'arrondi entier mord alors pour de bon).
 *
 * Attention : `beneficeTotal` est un PLAFOND, pas une prévision. Il suppose le
 * coefficient constant sur tout le budget, alors que briser le fait baisser.
 * C'est `lotTest` qui dit quoi faire maintenant.
 */
export function recommanderBrisage(items: readonly Item[], ctx: Contexte, options: OptionsRecommandation): Opportunite[] {
  const facteurNet = 1 - options.taxePct / 100;
  const roiMin = options.roiMin ?? 0;
  const out: Opportunite[] = [];

  for (const item of items) {
    const cout = options.couts.get(item.id);
    if (!cout || cout.prix <= 0 || item.nonBrisable || item.stats.length === 0) continue;

    const lignes = lignesDepuisItem(item, options.jet);
    const mesure = options.coefficients?.get(item.id);
    const coefficient = mesure ?? options.coefficient;
    const base = { niveau: item.niveau, lignes, coefficient };
    let focus: StatId | null = null;
    let valeur = calculerBrisage({ ...base, focus: null }, ctx).valeurEsperee;
    const vus = new Set<StatId>();
    for (const l of lignes) {
      // Seules les caractéristiques chiffrées sont focalisables (cf. `focalisable`).
      if (!focalisable(l.jet) || vus.has(l.statId)) continue;
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
    // Conseiller un objet qu'on ne peut pas s'offrir n'a pas de sens.
    if (quantite < 1) continue;

    const budgetRisque = (options.budget * (options.partRisquePct ?? 100)) / 100;
    const lotTest = Math.max(1, Math.min(quantite, Math.floor(budgetRisque / cout.prix)));
    out.push({
      item,
      source: cout.source,
      cout: cout.prix,
      valeurNette,
      benefice,
      roi,
      focus,
      coefficient,
      coefMesure: mesure !== undefined,
      quantite,
      beneficeTotal: quantite * benefice,
      lotTest,
      coutLot: lotTest * cout.prix,
      beneficeLot: lotTest * benefice,
      seuil: coefficientSeuil({ niveau: item.niveau, lignes, focus }, ctx, { prixRevient: cout.prix, taxePct: options.taxePct, nbObjets: 1 }),
    });
  }

  return out.sort((a, b) => b.beneficeTotal - a.beneficeTotal || b.roi - a.roi);
}
