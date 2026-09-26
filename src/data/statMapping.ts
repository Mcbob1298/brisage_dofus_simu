/**
 * Référentiel des caractéristiques et mapping depuis l'API DofusDude
 * (https://api.dofusdu.de/dofus3/v1/fr — champ `effects[].type.id`).
 *
 * Les ids d'effets ont été relevés sur le catalogue complet le 2026-09-22 :
 * ils sont identiques entre les équipements et les runes de forgemagie.
 * Toute caractéristique absente de `API_EFFECT_TO_STAT` et de `IGNORED_EFFECTS`
 * est loguée par `npm run sync-data` et retirée de l'objet.
 */

export type StatId =
  | 'pa'
  | 'pm'
  | 'portee'
  | 'invocation'
  | 'dommages'
  | 'pctDommagesArmes'
  | 'pctDommagesDistance'
  | 'pctDommagesMelee'
  | 'pctDommagesSorts'
  | 'soins'
  | 'pctCritique'
  | 'renvoiDommages'
  | 'retraitPa'
  | 'retraitPm'
  | 'esquivePa'
  | 'esquivePm'
  | 'pctResNeutre'
  | 'pctResDistance'
  | 'pctResMelee'
  | 'pctResTerre'
  | 'pctResFeu'
  | 'pctResEau'
  | 'pctResAir'
  | 'doNeutre'
  | 'doTerre'
  | 'doFeu'
  | 'doEau'
  | 'doAir'
  | 'doCritiques'
  | 'doPoussee'
  | 'doPieges'
  | 'armeDeChasse'
  | 'tacle'
  | 'fuite'
  | 'prospection'
  | 'sagesse'
  | 'puissance'
  | 'puissancePieges'
  | 'resNeutre'
  | 'resTerre'
  | 'resFeu'
  | 'resEau'
  | 'resAir'
  | 'resCritiques'
  | 'resPoussee'
  | 'force'
  | 'intelligence'
  | 'chance'
  | 'agilite'
  | 'vitalite'
  | 'pods'
  | 'initiative';

/** Famille de caractéristique : sert à la couleur des runes dessinées en SVG. */
export type StatFamille =
  | 'action' // PA, PM, Portée, Invocation
  | 'dommages' // Dommages, % Dommages, Do élémentaires, Do Cri/Pou/Pi, Renvoi
  | 'resistances' // Ré fixes et %, Ré Cri/Pou
  | 'retrait' // Retrait / Esquive PA-PM
  | 'primaire' // Force, Intelligence, Chance, Agilité, Vitalité, Sagesse, Puissance
  | 'secondaire'; // Critique, Soins, Tacle, Fuite, Prospection, Pods, Initiative, Chasse

export type StatDef = {
  id: StatId;
  label: string;
  /** Abréviation courte pour les runes dessinées (Vi, Fo, Cri…). */
  abbr: string;
  famille: StatFamille;
};

export const STATS: readonly StatDef[] = [
  { id: 'pa', label: 'PA', abbr: 'PA', famille: 'action' },
  { id: 'pm', label: 'PM', abbr: 'PM', famille: 'action' },
  { id: 'portee', label: 'Portée', abbr: 'Po', famille: 'action' },
  { id: 'invocation', label: 'Invocation', abbr: 'Invo', famille: 'action' },
  { id: 'dommages', label: 'Dommages', abbr: 'Do', famille: 'dommages' },
  { id: 'pctDommagesArmes', label: "% Dommages d'armes", abbr: 'Do%Ar', famille: 'dommages' },
  { id: 'pctDommagesDistance', label: '% Dommages distance', abbr: 'Do%Di', famille: 'dommages' },
  { id: 'pctDommagesMelee', label: '% Dommages mêlée', abbr: 'Do%Mé', famille: 'dommages' },
  { id: 'pctDommagesSorts', label: '% Dommages aux sorts', abbr: 'Do%So', famille: 'dommages' },
  { id: 'soins', label: 'Soins', abbr: 'So', famille: 'secondaire' },
  { id: 'pctCritique', label: '% Critique', abbr: 'Cri', famille: 'secondaire' },
  { id: 'renvoiDommages', label: 'Renvoi de dommages', abbr: 'DoRen', famille: 'dommages' },
  { id: 'retraitPa', label: 'Retrait PA', abbr: 'RetPA', famille: 'retrait' },
  { id: 'retraitPm', label: 'Retrait PM', abbr: 'RetPM', famille: 'retrait' },
  { id: 'esquivePa', label: 'Esquive PA', abbr: 'EsqPA', famille: 'retrait' },
  { id: 'esquivePm', label: 'Esquive PM', abbr: 'EsqPM', famille: 'retrait' },
  { id: 'pctResDistance', label: '% Résistance distance', abbr: 'Ré%Di', famille: 'resistances' },
  { id: 'pctResMelee', label: '% Résistance mêlée', abbr: 'Ré%Mé', famille: 'resistances' },
  { id: 'pctResNeutre', label: '% Résistance Neutre', abbr: 'Ré%N', famille: 'resistances' },
  { id: 'pctResTerre', label: '% Résistance Terre', abbr: 'Ré%T', famille: 'resistances' },
  { id: 'pctResFeu', label: '% Résistance Feu', abbr: 'Ré%F', famille: 'resistances' },
  { id: 'pctResEau', label: '% Résistance Eau', abbr: 'Ré%E', famille: 'resistances' },
  { id: 'pctResAir', label: '% Résistance Air', abbr: 'Ré%A', famille: 'resistances' },
  { id: 'doNeutre', label: 'Dommages Neutre', abbr: 'DoN', famille: 'dommages' },
  { id: 'doTerre', label: 'Dommages Terre', abbr: 'DoT', famille: 'dommages' },
  { id: 'doFeu', label: 'Dommages Feu', abbr: 'DoF', famille: 'dommages' },
  { id: 'doEau', label: 'Dommages Eau', abbr: 'DoE', famille: 'dommages' },
  { id: 'doAir', label: 'Dommages Air', abbr: 'DoA', famille: 'dommages' },
  { id: 'doCritiques', label: 'Dommages Critiques', abbr: 'DoCri', famille: 'dommages' },
  { id: 'doPoussee', label: 'Dommages Poussée', abbr: 'DoPou', famille: 'dommages' },
  { id: 'doPieges', label: 'Dommages Pièges', abbr: 'DoPi', famille: 'dommages' },
  { id: 'armeDeChasse', label: 'Arme de chasse', abbr: 'Chas', famille: 'secondaire' },
  { id: 'tacle', label: 'Tacle', abbr: 'Tac', famille: 'secondaire' },
  { id: 'fuite', label: 'Fuite', abbr: 'Fui', famille: 'secondaire' },
  { id: 'prospection', label: 'Prospection', abbr: 'Pp', famille: 'secondaire' },
  { id: 'sagesse', label: 'Sagesse', abbr: 'Sa', famille: 'primaire' },
  { id: 'puissance', label: 'Puissance', abbr: 'Pui', famille: 'primaire' },
  { id: 'puissancePieges', label: 'Puissance Pièges', abbr: 'PuiPi', famille: 'primaire' },
  { id: 'resNeutre', label: 'Résistance Neutre', abbr: 'RéN', famille: 'resistances' },
  { id: 'resTerre', label: 'Résistance Terre', abbr: 'RéT', famille: 'resistances' },
  { id: 'resFeu', label: 'Résistance Feu', abbr: 'RéF', famille: 'resistances' },
  { id: 'resEau', label: 'Résistance Eau', abbr: 'RéE', famille: 'resistances' },
  { id: 'resAir', label: 'Résistance Air', abbr: 'RéA', famille: 'resistances' },
  { id: 'resCritiques', label: 'Résistance Critiques', abbr: 'RéCri', famille: 'resistances' },
  { id: 'resPoussee', label: 'Résistance Poussée', abbr: 'RéPou', famille: 'resistances' },
  { id: 'force', label: 'Force', abbr: 'Fo', famille: 'primaire' },
  { id: 'intelligence', label: 'Intelligence', abbr: 'Ine', famille: 'primaire' },
  { id: 'chance', label: 'Chance', abbr: 'Cha', famille: 'primaire' },
  { id: 'agilite', label: 'Agilité', abbr: 'Age', famille: 'primaire' },
  { id: 'vitalite', label: 'Vitalité', abbr: 'Vi', famille: 'primaire' },
  { id: 'pods', label: 'Pods', abbr: 'Pod', famille: 'secondaire' },
  { id: 'initiative', label: 'Initiative', abbr: 'Ini', famille: 'secondaire' },
];

export const STAT_BY_ID: Readonly<Record<StatId, StatDef>> = Object.fromEntries(
  STATS.map((s) => [s.id, s]),
) as Record<StatId, StatDef>;

export const ALL_STAT_IDS: readonly StatId[] = STATS.map((s) => s.id);

export function isStatId(x: unknown): x is StatId {
  return typeof x === 'string' && x in STAT_BY_ID;
}

/** `effects[].type.id` DofusDude → StatId. */
export const API_EFFECT_TO_STAT: Readonly<Record<number, StatId>> = {
  12: 'pa',
  8: 'pm',
  31: 'portee',
  28: 'invocation',
  30: 'dommages',
  41: 'pctDommagesArmes',
  71: 'pctDommagesDistance',
  40: 'pctDommagesMelee',
  93: 'pctDommagesSorts',
  121: 'soins',
  29: 'pctCritique',
  249: 'renvoiDommages',
  64: 'retraitPa',
  50: 'retraitPm',
  75: 'esquivePa',
  39: 'esquivePm',
  // Runes Ré Per Di / Ré Per Mé, poids 15 (dofustool.com et millenium.org,
  // relevés le 2026-09-26). Elles existent à l'encyclopédie officielle.
  108: 'pctResDistance',
  65: 'pctResMelee',
  34: 'pctResNeutre',
  63: 'pctResTerre',
  37: 'pctResFeu',
  17: 'pctResEau',
  16: 'pctResAir',
  49: 'doNeutre',
  48: 'doTerre',
  61: 'doFeu',
  27: 'doEau',
  47: 'doAir',
  38: 'doCritiques',
  62: 'doPoussee',
  112: 'doPieges',
  92: 'armeDeChasse',
  26: 'tacle',
  59: 'fuite',
  25: 'prospection',
  10: 'sagesse',
  32: 'puissance',
  106: 'puissancePieges',
  33: 'resNeutre',
  15: 'resTerre',
  14: 'resFeu',
  82: 'resEau',
  60: 'resAir',
  46: 'resCritiques',
  70: 'resPoussee',
  45: 'force',
  13: 'intelligence',
  22: 'chance',
  36: 'agilite',
  9: 'vitalite',
  220: 'pods',
  24: 'initiative',
};

/**
 * Effets volontairement ignorés : ils ne produisent aucune rune au concasseur.
 * La raison est documentée pour chaque id ; tout id absent d'ici ET du mapping
 * est remonté comme « non mappé » par le sync.
 */
export const IGNORED_EFFECTS: Readonly<Record<number, string>> = {
  // Effets actifs d'armes (jet de dégâts / vol / soin à l'attaque), pas des caractéristiques.
  195: 'Arme : dommages Neutre',
  194: 'Arme : dommages Terre',
  198: 'Arme : dommages Feu',
  214: 'Arme : dommages Eau',
  189: 'Arme : dommages Air',
  248: 'Arme : dommages du meilleur élément',
  223: 'Arme : vol Neutre',
  221: 'Arme : vol Terre',
  193: 'Arme : vol Feu',
  203: 'Arme : vol Eau',
  224: 'Arme : vol Air',
  257: 'Arme : vol du meilleur élément',
  261: 'Arme : soins Feu',
  179: 'Arme : PA (actif)',
  238: 'Arme : PM (actif)',
  233: 'Arme : vole PM',
  241: 'Arme : vole Kamas',
  225: 'Arme : repousse de case',
  255: 'Arme : attire de case',
  258: 'Arme : avance de case',
  // Modificateurs de sorts (Dofus, trophées, panoplies).
  163: 'Sort spécial (méta)',
  204: 'Sort : portée modifiable',
  205: 'Sort : ligne de vue désactivée',
  206: 'Sort : + lancers par tour',
  207: 'Sort : - PA',
  208: 'Sort : + portée maximale',
  209: 'Sort : lancer en ligne désactivé',
  226: 'Sort : +% critique',
  227: 'Sort : - de relance',
  231: 'Sort : + lancers par cible',
  240: 'Sort : case occupée nécessaire désactivée',
  243: 'Sort : + dégâts de base',
  245: 'Sort : + dommages',
  274: 'Sort : - portée minimale',
  145: 'Ajoute un sort temporaire',
  // Panoplie « Malédiction de Cire Momore » : « 23 max. 4 », modificateur de sort.
  166: 'Sort : max.',
  // Méta / cosmétique / échange.
  0: 'Échangeable',
  81: 'Lié au personnage',
  83: 'Fabrication coopérative impossible',
  84: 'Reçu le',
  35: 'Titre',
  98: 'Attitude',
  101: "Quelqu'un vous suit (familier)",
  117: "Change l'apparence",
  119: 'Change les paroles',
  123: 'Nombre de victimes',
  191: 'Séparateur « / »',
  251: 'Taille %',
  262: 'Fertile (montures)',
};

export type Famille = 'Équipement' | 'Arme' | 'Trophée' | 'Dofus';
export type TypeMapping = { type: string; famille: Famille };

/**
 * Types d'objets DofusDude conservés (ceux qui passent au concasseur) → type affiché.
 * Tout autre type (familiers, montures, certificats, objets de percepteur, outils…)
 * est exclu du catalogue.
 */
export const API_TYPE_TO_TYPE: Readonly<Record<number, TypeMapping>> = {
  27: { type: 'Coiffe', famille: 'Équipement' },
  43: { type: 'Cape', famille: 'Équipement' },
  17: { type: 'Anneau', famille: 'Équipement' },
  33: { type: 'Amulette', famille: 'Équipement' },
  45: { type: 'Bottes', famille: 'Équipement' },
  58: { type: 'Ceinture', famille: 'Équipement' },
  87: { type: 'Bouclier', famille: 'Équipement' },
  23: { type: 'Trophée', famille: 'Trophée' },
  177: { type: 'Dofus', famille: 'Dofus' },
  80: { type: 'Épée', famille: 'Arme' },
  42: { type: 'Marteau', famille: 'Arme' },
  125: { type: 'Bâton', famille: 'Arme' },
  93: { type: 'Dague', famille: 'Arme' },
  65: { type: 'Baguette', famille: 'Arme' },
  39: { type: 'Arc', famille: 'Arme' },
  73: { type: 'Hache', famille: 'Arme' },
  52: { type: 'Pelle', famille: 'Arme' },
  111: { type: 'Lance', famille: 'Arme' },
  163: { type: 'Faux', famille: 'Arme' },
  182: { type: 'Arme magique', famille: 'Arme' },
  199: { type: 'Pioche', famille: 'Arme' },
};

/** Id du type « Rune de forgemagie » dans DofusDude (ressources). */
export const API_RUNE_TYPE_ID = 133;

/** Placeholder SVG par type affiché (voir public/img/placeholder/). */
export function placeholderPour(type: string, famille: Famille): string {
  const map: Record<string, string> = {
    Coiffe: 'coiffe',
    Cape: 'cape',
    Anneau: 'anneau',
    Amulette: 'amulette',
    Bottes: 'bottes',
    Ceinture: 'ceinture',
    Bouclier: 'bouclier',
    Trophée: 'trophee',
    Dofus: 'dofus',
  };
  const key = map[type] ?? (famille === 'Arme' ? 'arme' : 'objet');
  return `/img/placeholder/${key}.svg`;
}
