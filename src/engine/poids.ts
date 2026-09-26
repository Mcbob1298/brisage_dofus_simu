import type { StatId } from '../data/statMapping.ts';

/** Poids unitaire (par point de caractéristique) de chaque stat. Éditable dans l'UI. */
export type PoidsTable = Record<StatId, number>;

/**
 * Valeurs de départ, issues de la spec §3 (source : tables communautaires 2026,
 * https://dafous.app/guides/poids-runes-fm.html).
 *
 * Désaccords connus entre sources, d'où la possibilité de modifier ces valeurs
 * dans l'interface :
 *  - Vitalité : 0,25 ou 0,2 selon les auteurs ;
 *  - Ré Critiques / Ré Poussée : 2 ou 5.
 */
export const POIDS_DEFAUT: Readonly<PoidsTable> = {
  pa: 100,
  pm: 90,
  portee: 51,
  invocation: 30,
  dommages: 20,
  pctDommagesArmes: 15,
  pctDommagesDistance: 15,
  pctDommagesMelee: 15,
  pctDommagesSorts: 15,
  soins: 10,
  pctCritique: 10,
  renvoiDommages: 10,
  retraitPa: 7,
  retraitPm: 7,
  esquivePa: 7,
  esquivePm: 7,
  pctResNeutre: 6,
  pctResTerre: 6,
  pctResFeu: 6,
  pctResEau: 6,
  pctResAir: 6,
  doNeutre: 5,
  doTerre: 5,
  doFeu: 5,
  doEau: 5,
  doAir: 5,
  doCritiques: 5,
  doPoussee: 5,
  doPieges: 5,
  armeDeChasse: 5,
  tacle: 4,
  fuite: 4,
  prospection: 3,
  sagesse: 3,
  puissance: 2,
  puissancePieges: 2,
  resNeutre: 2,
  resTerre: 2,
  resFeu: 2,
  resEau: 2,
  resAir: 2,
  resCritiques: 2,
  resPoussee: 2,
  force: 1,
  intelligence: 1,
  chance: 1,
  agilite: 1,
  vitalite: 0.25,
  pods: 0.25,
  initiative: 0.1,
};

/**
 * Constante du concasseur : points restitués = poids × niveau × 0,015 × coef.
 * Source : https://github.com/KamelAkar/Calculateur_Brisage_Dofus (0,0150) et
 * https://papycha.fr/taux-de-brisage/ (formule niveau × poids × coefficient).
 */
export const CONSTANTE_BRISAGE = 0.015;

/** Part du poids des autres lignes reversée sur la ligne focus (spec §3, forum Dofus). */
export const PART_FOCUS = 0.5;

/**
 * Terme plancher ajouté au poids de CHAQUE ligne de caractéristique :
 *   poids_ligne = jet × poids_unitaire × niveau × 0,015 + 1
 * Le poids d'une rune simple valant exactement son poids unitaire, ce « + 1 »
 * revient à garantir une rune par ligne à 100 % de coefficient.
 *
 * Il est absent de la spec §3, dont le cas de contrôle (niveau 65, +10 %
 * Critiques → 9,75 runes) correspond à la formule sans plancher ; avec le
 * plancher on obtient 9,85. Trois sources concordantes l'emportent :
 *  - https://github.com/KamelAkar/Calculateur_Brisage_Dofus
 *    → `poids = ((value * poids_rune * level * 0.0150) + 1)` ;
 *  - https://papycha.fr/taux-de-brisage/ → poids de ligne = Stat × Poid_u, + 1 ;
 *  - DoFocus, relevé le 2026-09-26 sur Draconiros : Arc de Chasse (niveau 1,
 *    ligne « Arme de chasse » de jet 0, poids unitaire 5, coefficient 15 %)
 *    affiche 0,03 rune soit 266 kamas à 8 870 la rune. Le plancher seul donne
 *    1 × 0,15 ÷ 5 = 0,03 ✓ ; la formule sans plancher donnait 0.
 */
export const PLANCHER_LIGNE = 1;
