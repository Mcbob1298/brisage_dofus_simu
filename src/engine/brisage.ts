/**
 * Moteur de calcul du brisage — aucune dépendance UI.
 *
 * Le concasseur raisonne en POIDS. Chaque caractéristique de l'objet pèse
 *   poids_ligne = jet × poids_unitaire × niveau × 0,015 + 1
 * le « + 1 » étant un plancher par ligne (cf. PLANCHER_LIGNE). Ce poids est
 * ensuite modulé par le coefficient du serveur puis converti en runes :
 *   runes = poids_ligne × (coef / 100) ÷ poids_rune
 *
 * On expose des POINTS de caractéristique plutôt que des runes, car une même
 * stat se décline en plusieurs runes (Ga, Pa…) : poids_rune valant
 * poids_unitaire × valeur_rune, on a
 *   points = poids_ligne × (coef / 100) ÷ poids_unitaire
 * et `repartirRunes` divise ensuite par la valeur de la rune simple (1 pour la
 * plupart, 5 pour Vi, 10 pour Ini et Pod, cf. runes.json).
 *
 * Le poids intervient donc à deux endroits : le plancher (qui pèse d'autant
 * plus que la stat est légère) et le focus (transfert de 50 % du poids des
 * autres lignes).
 */
import type { StatId } from '../data/statMapping.ts';
import type { RuneDef } from '../data/types.ts';
import { CONSTANTE_BRISAGE, PART_FOCUS, PLANCHER_LIGNE, type PoidsTable } from './poids.ts';
import { repartirRunes } from './runes.ts';
import type {
  Bilan,
  BilanValeurs,
  ComparaisonFocus,
  Contexte,
  EntreeBrisage,
  LigneBrisage,
  OptionsBilan,
  PointsParStat,
  ResultatBrisage,
  ResultatStat,
} from './types.ts';

/**
 * Jets cumulés par caractéristique : le concasseur voit UNE ligne par stat, et
 * le plancher se compte une fois par ligne — deux lignes de Force ne valent
 * donc pas deux planchers.
 *
 * Les malus (jet < 0) ne rendent rien et ne transfèrent rien. Une ligne de jet
 * nul est en revanche conservée : ce n'est pas un malus mais une valeur absente
 * (drapeau « Arme de chasse »), et elle pèse son plancher — c'est ce que fait
 * DoFocus, cf. PLANCHER_LIGNE.
 */
export function jetsParStat(lignes: readonly LigneBrisage[]): Map<StatId, number> {
  const out = new Map<StatId, number>();
  for (const l of lignes) {
    if (!Number.isFinite(l.jet) || l.jet < 0) continue;
    out.set(l.statId, (out.get(l.statId) ?? 0) + l.jet);
  }
  return out;
}

/** Poids d'une ligne au sens du concasseur, plancher compris. */
function poidsLigne(jet: number, poidsUnitaire: number, niveau: number): number {
  return jet * poidsUnitaire * niveau * CONSTANTE_BRISAGE + PLANCHER_LIGNE;
}

/** Points de caractéristique restitués par stat, avant conversion en runes. */
export function calculerPoints(entree: EntreeBrisage, poids: Readonly<PoidsTable>): PointsParStat {
  const coef = entree.coefficient / 100;
  const jets = jetsParStat(entree.lignes);
  const points: PointsParStat = {};

  if (entree.focus === null) {
    for (const [statId, jet] of jets) {
      const poidsUnitaire = poids[statId];
      if (!(poidsUnitaire > 0)) continue;
      points[statId] = (poidsLigne(jet, poidsUnitaire, entree.niveau) * coef) / poidsUnitaire;
    }
    return points;
  }

  const focus = entree.focus;
  const poidsFocus = poids[focus];
  // Un focus sur une stat absente de l'objet est impossible en jeu : on ne rend rien.
  if (!(poidsFocus > 0) || !jets.has(focus)) return points;

  // poids_effectif = poids_ligne(focus) + Σ autres poids_ligne / 2
  let poidsEffectif = 0;
  for (const [statId, jet] of jets) {
    const poidsUnitaire = poids[statId];
    if (!(poidsUnitaire > 0)) continue;
    const p = poidsLigne(jet, poidsUnitaire, entree.niveau);
    poidsEffectif += statId === focus ? p : p * PART_FOCUS;
  }

  points[focus] = (poidsEffectif * coef) / poidsFocus;
  return points;
}

export function calculerBrisage(entree: EntreeBrisage, ctx: Contexte): ResultatBrisage {
  const points = calculerPoints(entree, ctx.poids);
  const parStat: ResultatStat[] = [];
  const prixManquants: RuneDef[] = [];

  for (const [statId, pts] of Object.entries(points) as [StatId, number][]) {
    const runesStat = ctx.runes.filter((r) => r.statId === statId);
    const rep = repartirRunes(pts, runesStat, ctx.mode, ctx.prix);
    const manquants = rep.runes.filter((r) => r.prixUnitaire === undefined).map((r) => r.rune);
    if (rep.runeReste && ctx.prix[rep.runeReste.id] === undefined && !manquants.includes(rep.runeReste)) {
      manquants.push(rep.runeReste);
    }
    const valeurGarantie = rep.runes.reduce((s, r) => s + r.quantite * (r.prixUnitaire ?? 0), 0);
    const valeurEsperee =
      valeurGarantie + (rep.runeReste ? rep.reste * (ctx.prix[rep.runeReste.id] ?? 0) : 0);
    parStat.push({
      statId,
      points: pts,
      runes: rep.runes,
      reste: rep.reste,
      runeReste: rep.runeReste,
      valeurGarantie,
      valeurEsperee,
      prixManquants: manquants,
    });
    for (const m of manquants) if (!prixManquants.includes(m)) prixManquants.push(m);
  }

  return {
    entree,
    parStat,
    valeurGarantie: parStat.reduce((s, r) => s + r.valeurGarantie, 0),
    valeurEsperee: parStat.reduce((s, r) => s + r.valeurEsperee, 0),
    prixManquants,
  };
}

function valeurs(brutUnitaire: number, options: OptionsBilan): BilanValeurs {
  const valeurBrute = brutUnitaire * options.nbObjets;
  const taxe = valeurBrute * (options.taxePct / 100);
  const valeurNette = valeurBrute - taxe;
  const coutTotal = options.prixRevient * options.nbObjets;
  const benefice = valeurNette - coutTotal;
  return {
    valeurBrute,
    taxe,
    valeurNette,
    benefice,
    roi: coutTotal > 0 ? (benefice / coutTotal) * 100 : null,
  };
}

export function calculerBilan(resultat: ResultatBrisage, options: OptionsBilan): Bilan {
  return {
    nbObjets: options.nbObjets,
    coutTotal: options.prixRevient * options.nbObjets,
    garanti: valeurs(resultat.valeurGarantie, options),
    espere: valeurs(resultat.valeurEsperee, options),
    retenu: options.nbObjets > 1 ? 'espere' : 'garanti',
  };
}

/**
 * Prix d'achat à ne pas dépasser pour un objet, au coefficient simulé.
 * Avec `roiPct = 0` c'est le seuil de rentabilité (bénéfice nul) ; au-delà, le
 * prix qui laisse la marge visée.
 */
export function prixAchatMax(valeurNetteUnitaire: number, roiPct = 0): number {
  return valeurNetteUnitaire / (1 + Math.max(0, roiPct) / 100);
}

export const SEUIL_MIN = 1;
export const SEUIL_MAX = 4000;

/**
 * Coefficient (en %) en dessous duquel on brise à perte, par recherche
 * dichotomique sur le bénéfice espéré entre 1 % et 4000 %.
 * Retourne `null` si le brisage n'est jamais rentable à 4000 %, et `SEUIL_MIN`
 * s'il l'est déjà à 1 %.
 */
export function coefficientSeuil(
  entree: Omit<EntreeBrisage, 'coefficient'>,
  ctx: Contexte,
  options: OptionsBilan,
  precision = 0.01,
): number | null {
  const benefice = (coefficient: number) =>
    calculerBilan(calculerBrisage({ ...entree, coefficient }, ctx), options).espere.benefice;

  if (benefice(SEUIL_MAX) < 0) return null;
  if (benefice(SEUIL_MIN) >= 0) return SEUIL_MIN;

  let bas = SEUIL_MIN; // bénéfice < 0
  let haut = SEUIL_MAX; // bénéfice ≥ 0
  while (haut - bas > precision) {
    const milieu = (bas + haut) / 2;
    if (benefice(milieu) >= 0) haut = milieu;
    else bas = milieu;
  }
  return haut;
}

/**
 * Compare le brisage naturel et un focus sur chaque ligne utile, classés par
 * bénéfice (vue retenue) décroissant. Le premier élément est le gagnant.
 */
export function comparerFocus(entree: EntreeBrisage, ctx: Contexte, options: OptionsBilan): ComparaisonFocus[] {
  const candidats: (StatId | null)[] = [null, ...jetsParStat(entree.lignes).keys()];
  const resultats = candidats.map((focus): ComparaisonFocus => {
    const e = { ...entree, focus };
    const resultat = calculerBrisage(e, ctx);
    const bilan = calculerBilan(resultat, options);
    const seuil = coefficientSeuil({ niveau: e.niveau, lignes: e.lignes, focus }, ctx, options);
    return { focus, resultat, bilan, seuil };
  });
  return resultats.sort((a, b) => b.bilan[b.bilan.retenu].benefice - a.bilan[a.bilan.retenu].benefice);
}
