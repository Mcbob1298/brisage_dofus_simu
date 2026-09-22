import type { StatId, Famille } from './statMapping.ts';
export type { Famille };


export type StatLine = {
  statId: StatId;
  /** Borne basse du jet (peut être négative pour un malus). */
  min: number;
  /** Borne haute du jet. */
  max: number;
};

export type Item = {
  id: number;
  nom: string;
  niveau: number;
  /** Type affiché : Coiffe, Cape, Anneau… ou le sous-type d'arme (Épée, Marteau…). */
  type: string;
  famille: Famille;
  /** Chemin vers l'icône locale (WebP 48×48) ou un placeholder SVG par type. */
  imageLocale: string;
  stats: StatLine[];
  panoplieId?: number;
  recetteConnue?: boolean;
  /** `undefined` si la source de drops n'a pas répondu pendant le sync. */
  droppable?: boolean;
};

export type RuneTier = 'simple' | 'pa' | 'ra';

/** Une rune de forgemagie telle qu'elle existe en jeu (issue de l'API, pas inventée). */
export type RuneDef = {
  /** Identifiant Ankama de l'objet rune. */
  id: number;
  /** Nom en jeu, ex. "Rune Pa Fo". */
  nom: string;
  statId: StatId;
  tier: RuneTier;
  /** Points de caractéristique conférés par une rune (ex. Rune Vi = 5, Rune Pa Fo = 3). */
  valeur: number;
  imageLocale: string;
};

/** Statut d'un type d'effet API rencontré pendant le sync. */
export type EffectTypeStatus = 'mapped' | 'ignored' | 'unmapped';

export type EffectTypeReport = {
  apiId: number;
  apiName: string;
  status: EffectTypeStatus;
  statId?: StatId;
  /** Nombre d'occurrences dans le catalogue final (objets conservés). */
  count: number;
  /** Quelques objets d'exemple, utiles pour compléter le mapping. */
  exemples: string[];
};

export type CatalogueMeta = {
  source: string;
  syncedAt: string;
  nbItems: number;
  nbRunes: number;
  nbImages: number;
  nbImagesEchouees: number;
  droppableDisponible: boolean;
};
