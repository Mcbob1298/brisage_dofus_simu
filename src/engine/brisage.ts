/**
 * Moteur de calcul du brisage — aucune dépendance UI.
 *
 * Formule (spec §3) : pour chaque ligne,
 *   points = jet × poids_unitaire × niveau × 0,015 × (coef / 100) ÷ poids_rune
 * Comme poids_rune = poids_unitaire × valeur_rune, le nombre de POINTS de
 * caractéristique restitués ne dépend pas du poids :
 *   points = jet × niveau × 0,015 × (coef / 100)
 * Le poids n'intervient que pour le focus (transfert de 50 % du poids des
 * autres lignes) — et la conversion points → runes divise par la valeur de la
 * rune simple (1 pour la plupart, 5 pour Vi, 10 pour Ini et Pod, cf. runes.json).
 */
import type { StatId } from '../data/statMapping.ts';
import type { RuneDef } from '../data/types.ts';
import { CONSTANTE_BRISAGE, PART_FOCUS, type PoidsTable } from './poids.ts';
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

/** Les lignes de malus (jet ≤ 0) ne produisent rien et ne transfèrent rien. */
function lignesUtiles(lignes: readonly LigneBrisage[]): LigneBrisage[] {
  return lignes.filter((l) => l.jet > 0 && Number.isFinite(l.jet));
}

/** Points de caractéristique restitués par stat, avant conversion en runes. */
export function calculerPoints(entree: EntreeBrisage, poids: Readonly<PoidsTable>): PointsParStat {
  const facteur = entree.niveau * CONSTANTE_BRISAGE * (entree.coefficient / 100);
  const lignes = lignesUtiles(entree.lignes);
  const points: PointsParStat = {};

  if (entree.focus === null) {
    for (const l of lignes) {
      points[l.statId] = (points[l.statId] ?? 0) + l.jet * facteur;
    }
    return points;
  }

  const focus = entree.focus;
  const poidsFocus = poids[focus];
  if (!(poidsFocus > 0)) return points;

  // poids_effectif = jet_focus × poids_focus + Σ autres (jet × poids) / 2
  let poidsEffectif = 0;
  let aLigneFocus = false;
  for (const l of lignes) {
    if (l.statId === focus) {
      poidsEffectif += l.jet * poidsFocus;
      aLigneFocus = true;
    } else {
      poidsEffectif += l.jet * poids[l.statId] * PART_FOCUS;
    }
  }
  // Un focus sur une stat absente de l'objet est impossible en jeu : on ne rend rien.
  if (!aLigneFocus) return points;

  points[focus] = (poidsEffectif * facteur) / poidsFocus;
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
  const candidats: (StatId | null)[] = [null];
  for (const l of lignesUtiles(entree.lignes)) {
    if (!candidats.includes(l.statId)) candidats.push(l.statId);
  }
  const resultats = candidats.map((focus): ComparaisonFocus => {
    const e = { ...entree, focus };
    const resultat = calculerBrisage(e, ctx);
    const bilan = calculerBilan(resultat, options);
    const seuil = coefficientSeuil({ niveau: e.niveau, lignes: e.lignes, focus }, ctx, options);
    return { focus, resultat, bilan, seuil };
  });
  return resultats.sort((a, b) => b.bilan[b.bilan.retenu].benefice - a.bilan[a.bilan.retenu].benefice);
}
