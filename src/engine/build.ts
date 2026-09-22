/**
 * Optimiseur d'équipement : choisit, pour chaque emplacement, l'objet qui
 * maximise un score = Σ (poids de la caractéristique × valeur du jet).
 *
 * Les poids sont ceux que choisit l'utilisateur (préréglages éditables) : ce
 * n'est PAS la formule de dégâts du jeu, qui dépend de la classe, des sorts et
 * des résistances de la cible. Pour la prospection en revanche, le score est
 * exact : 1 point de prospection = 1 point.
 *
 * Les bonus de panoplie sont pris en compte par recherche locale (on part du
 * meilleur objet par emplacement, puis on tente d'imposer les pièces d'une
 * panoplie) : c'est une heuristique, pas une garantie d'optimum.
 */
import type { StatId } from '../data/statMapping.ts';
import type { Item, Panoplie } from '../data/types.ts';
import type { JetChoisi } from './explorateur.ts';

export type Slot = 'coiffe' | 'cape' | 'amulette' | 'anneau' | 'ceinture' | 'bottes' | 'bouclier' | 'arme' | 'dofus';

export type SlotDef = { id: Slot; label: string; capacite: number };

/** Emplacements d'équipement, avec leur nombre de places. */
export const SLOTS: readonly SlotDef[] = [
  { id: 'coiffe', label: 'Coiffe', capacite: 1 },
  { id: 'cape', label: 'Cape', capacite: 1 },
  { id: 'amulette', label: 'Amulette', capacite: 1 },
  { id: 'anneau', label: 'Anneaux', capacite: 2 },
  { id: 'ceinture', label: 'Ceinture', capacite: 1 },
  { id: 'bottes', label: 'Bottes', capacite: 1 },
  { id: 'bouclier', label: 'Bouclier', capacite: 1 },
  { id: 'arme', label: 'Arme', capacite: 1 },
  { id: 'dofus', label: 'Dofus / Trophées', capacite: 6 },
];

const TYPE_VERS_SLOT: Readonly<Record<string, Slot>> = {
  Coiffe: 'coiffe',
  Cape: 'cape',
  Amulette: 'amulette',
  Anneau: 'anneau',
  Ceinture: 'ceinture',
  Bottes: 'bottes',
  Bouclier: 'bouclier',
  Trophée: 'dofus',
  Dofus: 'dofus',
};

export function slotDe(item: Item): Slot | null {
  if (item.famille === 'Arme') return 'arme';
  return TYPE_VERS_SLOT[item.type] ?? null;
}

export type Poids = Partial<Record<StatId, number>>;

export function jetDe(min: number, max: number, jet: JetChoisi): number {
  return jet === 'min' ? min : jet === 'max' ? max : Math.round((min + max) / 2);
}

/** Valeurs des caractéristiques d'un objet selon le jet retenu (malus inclus). */
export function statsItem(item: Item, jet: JetChoisi): Partial<Record<StatId, number>> {
  const out: Partial<Record<StatId, number>> = {};
  for (const s of item.stats) out[s.statId] = (out[s.statId] ?? 0) + jetDe(s.min, s.max, jet);
  return out;
}

export function scoreStats(stats: Partial<Record<StatId, number>>, poids: Poids): number {
  let total = 0;
  for (const [statId, valeur] of Object.entries(stats) as [StatId, number][]) {
    total += (poids[statId] ?? 0) * valeur;
  }
  return total;
}

export type Build = {
  /** Objets retenus par emplacement. */
  parSlot: Record<Slot, Item[]>;
  /** Total des caractéristiques, bonus de panoplie inclus. */
  totaux: Partial<Record<StatId, number>>;
  score: number;
  /** Panoplies actives : nombre de pièces portées et bonus obtenu. */
  panoplies: { panoplie: Panoplie; pieces: number; bonus: { statId: StatId; valeur: number }[] }[];
};

export type OptionsBuild = {
  niveauJoueur: number;
  poids: Poids;
  jet: JetChoisi;
  /** Objets imposés (déjà possédés ou choisis à la main), par id. */
  fixes?: readonly number[];
  /** Exclure les objets droppables ? (sans objet ici, gardé pour symétrie) */
  panoplies?: readonly Panoplie[];
};

function videParSlot(): Record<Slot, Item[]> {
  return Object.fromEntries(SLOTS.map((s) => [s.id, [] as Item[]])) as Record<Slot, Item[]>;
}

function cumuler(cible: Partial<Record<StatId, number>>, source: Partial<Record<StatId, number>>) {
  for (const [k, v] of Object.entries(source) as [StatId, number][]) cible[k] = (cible[k] ?? 0) + v;
}

/** Bonus actifs d'une panoplie pour `pieces` pièces portées (palier le plus haut atteint). */
export function bonusPanoplie(p: Panoplie, pieces: number): { statId: StatId; valeur: number }[] {
  let meilleur: { statId: StatId; valeur: number }[] = [];
  let palier = 0;
  for (const [nb, bonus] of Object.entries(p.bonus)) {
    const n = Number(nb);
    if (n <= pieces && n > palier) {
      palier = n;
      meilleur = bonus;
    }
  }
  return meilleur;
}

function evaluer(parSlot: Record<Slot, Item[]>, options: OptionsBuild): Build {
  const totaux: Partial<Record<StatId, number>> = {};
  const comptePanoplie = new Map<number, number>();
  for (const s of SLOTS) {
    for (const item of parSlot[s.id]) {
      cumuler(totaux, statsItem(item, options.jet));
      if (item.panoplieId !== undefined) comptePanoplie.set(item.panoplieId, (comptePanoplie.get(item.panoplieId) ?? 0) + 1);
    }
  }
  const panoplies: Build['panoplies'] = [];
  for (const p of options.panoplies ?? []) {
    const pieces = comptePanoplie.get(p.id) ?? 0;
    if (pieces < 2) continue;
    const bonus = bonusPanoplie(p, pieces);
    if (!bonus.length) continue;
    panoplies.push({ panoplie: p, pieces, bonus });
    for (const b of bonus) totaux[b.statId] = (totaux[b.statId] ?? 0) + b.valeur;
  }
  return { parSlot, totaux, score: scoreStats(totaux, options.poids), panoplies };
}

/** Meilleurs objets par emplacement, sans tenir compte des panoplies. */
function meilleursParSlot(candidats: readonly Item[], options: OptionsBuild): Record<Slot, Item[]> {
  const parSlot = videParSlot();
  const pool: Record<Slot, Item[]> = videParSlot();
  for (const item of candidats) {
    const slot = slotDe(item);
    if (slot) pool[slot].push(item);
  }
  const fixes = new Set(options.fixes ?? []);
  for (const s of SLOTS) {
    const imposes = pool[s.id].filter((i) => fixes.has(i.id)).slice(0, s.capacite);
    const autres = pool[s.id]
      .filter((i) => !fixes.has(i.id))
      .sort((a, b) => scoreStats(statsItem(b, options.jet), options.poids) - scoreStats(statsItem(a, options.jet), options.poids));
    parSlot[s.id] = [...imposes, ...autres.slice(0, s.capacite - imposes.length)].filter(
      (i) => scoreStats(statsItem(i, options.jet), options.poids) > 0 || fixes.has(i.id),
    );
  }
  return parSlot;
}

/**
 * Compose un équipement : meilleur objet par emplacement, puis tentative
 * d'imposer chaque panoplie (recherche locale) pour capter ses bonus.
 */
export function optimiser(items: readonly Item[], options: OptionsBuild): Build {
  const candidats = items.filter((i) => i.niveau <= options.niveauJoueur && i.stats.length > 0 && slotDe(i) !== null);
  const base = evaluer(meilleursParSlot(candidats, options), options);
  const panoplies = options.panoplies ?? [];
  if (panoplies.length === 0) return base;

  const fixes = new Set(options.fixes ?? []);
  const parPanoplie = new Map<number, Item[]>();
  for (const i of candidats) {
    if (i.panoplieId === undefined) continue;
    if (!parPanoplie.has(i.panoplieId)) parPanoplie.set(i.panoplieId, []);
    parPanoplie.get(i.panoplieId)!.push(i);
  }

  let meilleur = base;
  for (const p of panoplies) {
    const pieces = parPanoplie.get(p.id);
    if (!pieces || pieces.length < 2) continue;
    // On impose les pièces de la panoplie (les meilleures par emplacement), le reste est recalculé.
    const imposes = new Set(fixes);
    const parSlotPanoplie = videParSlot();
    for (const i of pieces) {
      const slot = slotDe(i);
      if (slot) parSlotPanoplie[slot].push(i);
    }
    for (const s of SLOTS) {
      parSlotPanoplie[s.id]
        .sort((a, b) => scoreStats(statsItem(b, options.jet), options.poids) - scoreStats(statsItem(a, options.jet), options.poids))
        .slice(0, s.capacite)
        .forEach((i) => imposes.add(i.id));
    }
    const essai = evaluer(meilleursParSlot(candidats, { ...options, fixes: [...imposes] }), options);
    if (essai.score > meilleur.score) meilleur = essai;
  }
  return meilleur;
}

/** Alternatives pour un emplacement, classées par score (pour changer un choix à la main). */
export function alternatives(items: readonly Item[], slot: Slot, options: OptionsBuild, limite = 15): Item[] {
  return items
    .filter((i) => slotDe(i) === slot && i.niveau <= options.niveauJoueur && i.stats.length > 0)
    .map((i) => ({ i, s: scoreStats(statsItem(i, options.jet), options.poids) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || b.i.niveau - a.i.niveau)
    .slice(0, limite)
    .map((x) => x.i);
}

/** Préréglages de poids, tous modifiables par l'utilisateur. */
export const PRESETS: { id: string; label: string; aide: string; poids: Poids }[] = [
  {
    id: 'prospection',
    label: 'Prospection',
    aide: 'Maximise les taux de drop : plus d’objets ramassés, donc plus de runes.',
    poids: { prospection: 1 },
  },
  {
    id: 'prospectionVita',
    label: 'Prospection + survie',
    aide: 'Prospection d’abord, un peu de vitalité pour enchaîner les combats.',
    poids: { prospection: 1, vitalite: 0.02 },
  },
  {
    id: 'degats',
    label: 'Dégâts (score simple)',
    aide: 'Somme pondérée des lignes offensives — ce n’est pas la formule de dégâts du jeu, ajuste les poids.',
    poids: {
      dommages: 10,
      doNeutre: 8,
      doTerre: 8,
      doFeu: 8,
      doEau: 8,
      doAir: 8,
      puissance: 1,
      force: 0.5,
      intelligence: 0.5,
      chance: 0.5,
      agilite: 0.5,
      pctDommagesArmes: 3,
      pctDommagesDistance: 3,
      pctDommagesMelee: 3,
      pctDommagesSorts: 3,
      pctCritique: 1,
      pa: 60,
      pm: 40,
    },
  },
];

/** Les quatre voies élémentaires du jeu, avec leur caractéristique et leur ligne de dommages. */
export type Element = 'terre' | 'feu' | 'eau' | 'air';

export const ELEMENTS: readonly { id: Element; label: string; stat: StatId; dommages: StatId; resistance: StatId }[] = [
  { id: 'terre', label: 'Terre', stat: 'force', dommages: 'doTerre', resistance: 'pctResTerre' },
  { id: 'feu', label: 'Feu', stat: 'intelligence', dommages: 'doFeu', resistance: 'pctResFeu' },
  { id: 'eau', label: 'Eau', stat: 'chance', dommages: 'doEau', resistance: 'pctResEau' },
  { id: 'air', label: 'Air', stat: 'agilite', dommages: 'doAir', resistance: 'pctResAir' },
];

/**
 * Poids « dégâts » orientés vers un élément : la caractéristique de l'élément et
 * ses dommages pèsent, les autres éléments ne comptent pas.
 *
 * Ces poids sont un score de comparaison, PAS la formule de dégâts du jeu : ils
 * sont proposés comme point de départ et restent modifiables.
 */
export function poidsElement(element: Element, avecProspection = 0): Poids {
  const e = ELEMENTS.find((x) => x.id === element)!;
  // En voie Eau, la chance sert deux fois : dégâts et prospection (1 pour 10).
  const bonusChance = avecProspection > 0 ? avecProspection / 10 : 0;
  return {
    [e.stat]: 1 + (e.stat === 'chance' ? bonusChance : 0),
    [e.dommages]: 8,
    dommages: 10,
    puissance: 1,
    pctDommagesArmes: 3,
    pctDommagesDistance: 3,
    pctDommagesMelee: 3,
    pctDommagesSorts: 3,
    pctCritique: 1,
    pa: 60,
    pm: 40,
    portee: 5,
    vitalite: 0.02,
    ...(avecProspection > 0 ? { prospection: avecProspection, chance: (ELEMENTS.find((x) => x.id === element)!.stat === 'chance' ? 0 : bonusChance) } : {}),
  };
}

export type EtapeProgression = {
  /** Niveau requis pour porter l'objet. */
  niveau: number;
  slot: Slot;
  item: Item;
  /** Objet qu'il remplace (celui porté jusque-là), si connu. */
  remplace: Item | null;
  /** Gain de score par rapport à l'objet remplacé. */
  gain: number;
};

/**
 * Prochains équipements à viser : pour chaque emplacement, les objets qui
 * deviendront le meilleur choix en montant de niveau. Les bonus de panoplie ne
 * sont pas pris en compte ici (c'est une liste d'objectifs, pas un build).
 */
export function progression(items: readonly Item[], options: OptionsBuild, niveauMax = 200): EtapeProgression[] {
  const etapes: EtapeProgression[] = [];
  for (const s of SLOTS) {
    const candidats = items
      .filter((i) => slotDe(i) === s.id && i.stats.length > 0 && i.niveau <= niveauMax)
      .map((i) => ({ item: i, score: scoreStats(statsItem(i, options.jet), options.poids) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => a.item.niveau - b.item.niveau);

    // Meilleur objet portable aujourd'hui : point de départ de la progression.
    let meilleur = 0;
    let porte: Item | null = null;
    for (const c of candidats) {
      if (c.item.niveau > options.niveauJoueur) continue;
      if (c.score > meilleur) {
        meilleur = c.score;
        porte = c.item;
      }
    }
    for (const c of candidats) {
      if (c.item.niveau <= options.niveauJoueur || c.score <= meilleur) continue;
      etapes.push({ niveau: c.item.niveau, slot: s.id, item: c.item, remplace: porte, gain: c.score - meilleur });
      meilleur = c.score;
      porte = c.item;
    }
  }
  return etapes.sort((a, b) => a.niveau - b.niveau || b.gain - a.gain);
}

/**
 * Prospection de départ d'un personnage.
 * Source : https://dofus.jeuxonline.info/article/2084/prospection
 * « Vous possédez 100 points de prospection quand vous débutez ».
 */
export const PROSPECTION_BASE = 100;

/**
 * Points de chance nécessaires pour 1 point de prospection.
 * Source : https://dofus.jeuxonline.info/article/2084/prospection
 * « +1 point en prospection tous les 10 points de chance ».
 */
export const CHANCE_PAR_PROSPECTION = 10;

export type DetailProspection = {
  base: number;
  /** Apport de la chance (équipement + points investis). */
  parChance: number;
  /** Prospection portée par l'équipement. */
  equipement: number;
  total: number;
};

/**
 * Prospection réelle : base + chance/10 + prospection de l'équipement.
 * `chanceHorsEquipement` couvre les points de caractéristique et les parchemins.
 */
export function prospectionTotale(
  totaux: Partial<Record<StatId, number>>,
  chanceHorsEquipement = 0,
): DetailProspection {
  const chance = (totaux.chance ?? 0) + chanceHorsEquipement;
  const parChance = Math.floor(chance / CHANCE_PAR_PROSPECTION);
  const equipement = Math.round(totaux.prospection ?? 0);
  return { base: PROSPECTION_BASE, parChance, equipement, total: PROSPECTION_BASE + parChance + equipement };
}

/**
 * Poids de l'objectif « prospection » : la chance compte, à raison de
 * 1 prospection pour 10 chance (cf. CHANCE_PAR_PROSPECTION).
 */
export function poidsProspection(): Poids {
  return { prospection: 1, chance: 1 / CHANCE_PAR_PROSPECTION, vitalite: 0.02 };
}
