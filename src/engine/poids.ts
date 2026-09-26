import type { StatId } from '../data/statMapping.ts';

/** Poids unitaire (par point de caractéristique) de chaque stat. Éditable dans l'UI. */
export type PoidsTable = Record<StatId, number>;

/**
 * Poids unitaire (par point) de chaque caractéristique.
 *
 * Recoupé le 2026-09-26 sur quatre tables communautaires indépendantes :
 *  - https://www.dofustool.com/poids-runes-dofus/
 *  - https://dofus-portals.fr/forgemagie/
 *  - https://www.onlygames.fr/poids-runes-dofus/
 *  - https://dafous.app/guides/poids-runes-fm.html (source d'origine de la spec)
 * Elles s'accordent sur toute la table sauf la Vitalité (cf. ci-dessous).
 *
 * VITALITÉ = 0,2 et non 0,25 comme l'annonçait la spec §3. Trois sources sur
 * quatre donnent 0,2, et le recoupement structurel tranche : les poids publiés
 * des runes Vi / Pa Vi / Ra Vi valent 1 / 3 / 10, or ces runes rendent 5 / 15 /
 * 50 points de vitalité (valeurs lues dans l'API, cf. runes.json). 0,2 × ces
 * valeurs donne exactement 1 / 3 / 10 ; 0,25 donnerait 1,25 / 3,75 / 12,5, que
 * personne ne rapporte. Le même test passe pour toutes les autres lignes.
 *
 * RESTE INCERTAIN : les Pods. Trois sources donnent 0,25 par point, mais aucune
 * ne publie le poids de la Rune Pod (qui rend 10 pods), donc le test structurel
 * ci-dessus ne peut pas s'appliquer. À 0,25 la Rune Pod pèserait 2,5, là où les
 * deux autres runes multi-points (Vi et Ini) pèsent 1. Un calculateur de
 * référence divise d'ailleurs les pods par 2,5, ce qui revient à un poids de
 * 0,1. On garde 0,25, valeur majoritaire et modifiable dans l'interface, mais
 * les pods sont la seule ligne de cette table non recoupée.
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
  pctResDistance: 15,
  pctResMelee: 15,
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
  vitalite: 0.2,
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
 *
 * CONFIRMÉ EN JEU le 2026-09-26 : le brisage de Baguettes de Liriel a bien
 * rendu des Runes Chas, alors que leur ligne « Arme de chasse » n'a AUCUNE
 * valeur. Sans plancher, cette ligne ne rendrait rien. C'est la seule preuve
 * directe dont on dispose, et elle ne porte que sur l'existence du rendement,
 * pas encore sur sa quantité.
 */
export const PLANCHER_LIGNE = 1;
