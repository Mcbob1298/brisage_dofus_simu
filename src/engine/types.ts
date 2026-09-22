import type { StatId } from '../data/statMapping.ts';
import type { RuneDef } from '../data/types.ts';
import type { PoidsTable } from './poids.ts';

/** Une ligne de caractéristique telle qu'on la brise : un jet fixé. */
export type LigneBrisage = {
  statId: StatId;
  jet: number;
};

export type EntreeBrisage = {
  niveau: number;
  lignes: LigneBrisage[];
  /** Coefficient du concasseur, en % (100 = normal). */
  coefficient: number;
  /** Stat ciblée par le focus, ou `null` pour un brisage naturel. */
  focus: StatId | null;
};

/**
 * Répartition des points en runes. La répartition exacte Ra/Pa/simples n'est
 * documentée nulle part publiquement : `greedy` est l'hypothèse la plus proche
 * du comportement observé, `valeurMax` une borne haute théorique.
 */
export type ModeRepartition = 'greedy' | 'valeurMax' | 'toutSimple';

/** Prix unitaire des runes, en kamas, indexé par id Ankama de la rune. */
export type PrixRunes = Readonly<Partial<Record<number, number>>>;

export type Contexte = {
  poids: Readonly<PoidsTable>;
  runes: readonly RuneDef[];
  prix: PrixRunes;
  mode: ModeRepartition;
};

/** Points de caractéristique restitués par stat (unité : 1 point de la stat). */
export type PointsParStat = Partial<Record<StatId, number>>;

export type RuneObtenue = {
  rune: RuneDef;
  /** Nombre entier de runes garanties. */
  quantite: number;
  /** `undefined` si le prix n'est pas renseigné. */
  prixUnitaire: number | undefined;
};

export type ResultatStat = {
  statId: StatId;
  points: number;
  runes: RuneObtenue[];
  /** Fraction (0 ≤ x < 1) d'une rune simple : probabilité d'en obtenir une de plus. */
  reste: number;
  /** Rune simple concernée par le reste, `null` si aucune rune n'existe pour cette stat. */
  runeReste: RuneDef | null;
  /** Kamas des runes entières. */
  valeurGarantie: number;
  /** Kamas en espérance (runes entières + reste × prix de la rune simple). */
  valeurEsperee: number;
  /** Runes dont le prix manque (comptées à 0). */
  prixManquants: RuneDef[];
};

export type ResultatBrisage = {
  entree: EntreeBrisage;
  parStat: ResultatStat[];
  valeurGarantie: number;
  valeurEsperee: number;
  prixManquants: RuneDef[];
};

export type OptionsBilan = {
  /** Prix de revient d'un objet, en kamas. */
  prixRevient: number;
  /** Taxe de vente en % appliquée à la valeur brute des runes. */
  taxePct: number;
  nbObjets: number;
};

export type BilanValeurs = {
  valeurBrute: number;
  taxe: number;
  valeurNette: number;
  benefice: number;
  /** ROI en %, `null` si le coût total est nul. */
  roi: number | null;
};

export type Bilan = {
  nbObjets: number;
  coutTotal: number;
  /** Valeurs garanties (runes entières uniquement), pour le lot entier. */
  garanti: BilanValeurs;
  /** Valeurs en espérance, pour le lot entier. */
  espere: BilanValeurs;
  /** Vue à privilégier : garanti pour 1 objet, espérance pour un lot. */
  retenu: 'garanti' | 'espere';
};

export type ComparaisonFocus = {
  focus: StatId | null;
  resultat: ResultatBrisage;
  bilan: Bilan;
  /** Coefficient seuil de rentabilité pour cette stratégie, `null` si jamais rentable. */
  seuil: number | null;
};
