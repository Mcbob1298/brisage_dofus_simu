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
