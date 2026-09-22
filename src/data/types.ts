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

/** Un objet lâché par un monstre, avec son taux de base (prospection 100). */
export type DropItem = {
  itemId: number;
  /** Taux de drop en %, tel que fourni par l'API (identique pour tous les grades). */
  taux: number;
  /** Niveau de joueur minimum requis, si le drop est conditionné (critère `PL`). */
  plMin?: number;
  plMax?: number;
};

export type Monstre = {
  id: number;
  nom: string;
  /** Niveau du grade le plus bas (les grades supérieurs sont plus costauds). */
  niveau: number;
  niveauMax: number;
  boss: boolean;
  /** Archimonstre (version « mini-boss » d'un monstre normal) : apparition rare. */
  archimonstre: boolean;
  /** Noms des sous-zones où on le croise, « Zone / Sous-zone ». */
  zones: string[];
  /** Uniquement les objets du catalogue (équipements brisables). */
  drops: DropItem[];
};

export type DropsMeta = {
  source: string;
  nbMonstres: number;
  nbDrops: number;
};

/** Bonus d'une panoplie : caractéristiques gagnées à partir de N pièces portées. */
export type Panoplie = {
  id: number;
  nom: string;
  niveau: number;
  /** Nombre de pièces → bonus cumulés à ce palier (valeurs absolues, pas incrémentales). */
  bonus: Record<number, { statId: StatId; valeur: number }[]>;
};

/** Classe de personnage (données du jeu, DofusDB /breeds). */
export type Classe = { id: number; nom: string };
