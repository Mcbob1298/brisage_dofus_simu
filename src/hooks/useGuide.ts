import { useMemo } from 'react';
import { STAT_BY_ID, type StatId } from '../data/statMapping.ts';
import type { Item } from '../data/types.ts';
import {
  calculerBilan,
  calculerBrisage,
  coefficientSeuil,
  evaluerCatalogue,
  lignesDepuisItem,
  planifier,
  type EvaluationItem,
  type Plan,
} from '../engine/index.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { budgetTest, niveauMaxIndicatif, useGuide, type Candidat } from '../store/guide.ts';
import { coutRetenu, dernierCoef, useNotes, type SourceCout } from '../store/notes.ts';
import { useSimu } from '../store/simu.ts';
import { useContexte } from './useSimulation.ts';

export type EtatCandidat = 'ecarte' | 'manquePrix' | 'tropCher' | 'aTester' | 'perte' | 'pret';

export type CandidatEvalue = {
  candidat: Candidat;
  item: Item;
  prix: number | null;
  prixDate: string | null;
  source: SourceCout | null;
  prixHdv: number | null;
  coutCraft: number | null;
  coef: number | null;
  coefDate: string | null;
  /** Valeur espérée brute à 100 %, meilleur focus (repère indépendant du coef). */
  valeur100: number;
  /** Meilleure stratégie au coef noté (ou 100 % si non testé). */
  focus: StatId | null;
  /** Bénéfice espéré par objet, net de taxe, au coef noté (0 % si pas de coef). */
  benefice: number;
  roi: number | null;
  seuil: number | null;
  etat: EtatCandidat;
  plan: Plan | null;
};

export type LigneValeur = { statId: StatId; jet: number; valeur: number };

export type Suggestion = {
  eval: EvaluationItem;
  /** Coût d'acquisition retenu (le moins cher entre HDV et craft), s'il existe. */
  prix: number | null;
  source: SourceCout | null;
  prixHdv: number | null;
  coutCraft: number | null;
  /** Prix max d'achat : valeur nette au coef supposé ÷ (1 + ROI visé). */
  prixMax: number;
  /** Lignes de l'objet classées par kamas rapportés (pour le reconnaître en HDV). */
  lignes: LigneValeur[];
  /** Bénéfice estimé à coef 100 % (valeur nette de taxe − prix), si prix noté. */
  beneficeEstime: number | null;
  roiEstime: number | null;
  /** Coefficient à partir duquel l'objet devient rentable à ce prix (estimation linéaire). */
  seuilEstime: number | null;
};

/** Au-delà de ce coefficient requis, on ne propose même plus l'objet. */
export const SEUIL_MAX_SUGGESTION = 300;

export type Suggestions = {
  /** Prix noté ≤ prix max (et ≤ budget de test) : bonnes affaires, classées par bénéfice estimé. */
  surMesure: Suggestion[];
  /** Abordables mais rentables seulement au-dessus de 100 % (jusqu'à SEUIL_MAX_SUGGESTION), classés par seuil croissant. */
  siCoefEleve: Suggestion[];
  /** Abordables mais jamais rentables sous SEUIL_MAX_SUGGESTION. */
  nbNonRentables: number;
  /** Objets sans prix noté, classés par densité ou valeur. */
  aChiffrer: Suggestion[];
  /** Objets écartés parce que leur prix noté dépasse le budget d'un test. */
  nbTropChers: number;
  /** Budget maximal d'un test (part de la bourse). */
  budget: number | null;
  niveauMax: number;
  auto: boolean;
};

/**
 * Suggestions : objets non droppables, aux runes toutes pricées, pas encore
 * candidats, dans la tranche de niveau choisie (ou indicative selon la bourse).
 * Un prix HDV noté trop cher pour la bourse retire l'objet ; un prix abordable
 * le fait passer dans le bloc « sur mesure », classé par bénéfice estimé.
 */
export function useSuggestions(limite = 10): Suggestions {
  const items = useCatalogue((s) => s.items);
  const ctx = useContexte();
  const { jet, candidats, kamasActuels, niveauMaxSuggestions, triSuggestions, partBudgetTest, coefSuppose, roiVise, categorieHdv } = useGuide();
  const budget = budgetTest(kamasActuels, partBudgetTest);
  const prixConstates = useNotes((s) => s.prixConstates);
  const coutsCraft = useNotes((s) => s.coutsCraft);
  const taxePct = useSimu((s) => s.taxePct);
  const niveauMax = niveauMaxSuggestions ?? niveauMaxIndicatif(kamasActuels);
  const evaluations = useMemo(() => evaluerCatalogue(items, ctx, jet), [items, ctx, jet]);
  // Un objet crafté vise les jets max : on réévalue en max ceux dont le craft est le coût retenu.
  const evaluationsMax = useMemo(() => (jet === 'max' ? evaluations : evaluerCatalogue(items, ctx, 'max')), [items, ctx, jet, evaluations]);
  return useMemo(() => {
    const deja = new Set(candidats.map((c) => c.itemId));
    // Diviseur plancher à 20 : sinon les objets niveau 1 (souvent des récompenses de quête) écrasent le tri.
    const cle = (e: EvaluationItem) => (triSuggestions === 'densite' ? e.valeurMeilleure / Math.max(20, e.item.niveau) : e.valeurMeilleure);
    const eligibles = evaluations.filter(
      (e) =>
        e.item.stats.length > 0 &&
        e.item.droppable !== true &&
        !e.prixManquants &&
        !deja.has(e.item.id) &&
        e.item.niveau <= niveauMax &&
        (categorieHdv === '' || (categorieHdv === 'Arme' ? e.item.famille === 'Arme' : e.item.type === categorieHdv)),
    );
    const facteurNet = 1 - taxePct / 100;
    const surMesure: Suggestion[] = [];
    const siCoefEleve: Suggestion[] = [];
    const aChiffrer: Suggestion[] = [];
    let nbTropChers = 0;
    let nbNonRentables = 0;
    for (let e of eligibles) {
      const cout = coutRetenu(prixConstates[e.item.id], coutsCraft[e.item.id]);
      const prix = cout?.prix ?? null;
      const jetObjet = cout?.source === 'craft' ? 'max' : jet;
      if (jetObjet === 'max' && jet !== 'max') e = evaluationsMax.find((x) => x.item.id === e.item.id) ?? e;
      const valeurNette100 = e.valeurMeilleure * facteurNet;
      // Prix max d'achat : ce que valent les runes au coef supposé, moins le ROI visé.
      const prixMax = (valeurNette100 * (coefSuppose / 100)) / (1 + roiVise / 100);
      // Lignes classées par kamas rapportés en brisage naturel (jet choisi, coef 100 %).
      const lignes: LigneValeur[] = lignesDepuisItem(e.item, jetObjet)
        .filter((l) => l.jet > 0)
        .map((l) => {
          const r = calculerBrisage({ niveau: e.item.niveau, lignes: [l], coefficient: 100, focus: null }, ctx);
          return { statId: l.statId, jet: l.jet, valeur: r.valeurEsperee };
        })
        .sort((a, b) => b.valeur - a.valeur);
      const base = { eval: e, prixMax, lignes, source: cout?.source ?? null, prixHdv: prixConstates[e.item.id]?.prix ?? null, coutCraft: coutsCraft[e.item.id]?.prix ?? null };
      if (prix === null) {
        aChiffrer.push({ ...base, prix: null, beneficeEstime: null, roiEstime: null, seuilEstime: null });
        continue;
      }
      if ((budget !== null && prix > budget) || prix > prixMax) {
        nbTropChers++;
        continue;
      }
      const beneficeEstime = valeurNette100 * (coefSuppose / 100) - prix;
      // La valeur des runes est linéaire en coef : seuil ≈ prix / valeur nette à 100 %.
      const seuilEstime = valeurNette100 > 0 ? (prix / valeurNette100) * 100 : null;
      const s: Suggestion = { ...base, prix, beneficeEstime, roiEstime: prix > 0 ? (beneficeEstime / prix) * 100 : null, seuilEstime };
      if (beneficeEstime > 0) surMesure.push(s);
      else if (seuilEstime !== null && seuilEstime <= SEUIL_MAX_SUGGESTION) siCoefEleve.push(s);
      else nbNonRentables++;
    }
    surMesure.sort((a, b) => b.beneficeEstime! - a.beneficeEstime!);
    siCoefEleve.sort((a, b) => a.seuilEstime! - b.seuilEstime!);
    aChiffrer.sort((a, b) => cle(b.eval) - cle(a.eval));
    return { surMesure, siCoefEleve, nbNonRentables, aChiffrer: aChiffrer.slice(0, limite), nbTropChers, budget, niveauMax, auto: niveauMaxSuggestions === null };
  }, [evaluations, evaluationsMax, candidats, niveauMax, triSuggestions, limite, prixConstates, coutsCraft, budget, taxePct, niveauMaxSuggestions, coefSuppose, roiVise, categorieHdv, jet, ctx]);
}

export type KamasParPoint = { statId: StatId; label: string; kamasParPoint: number };

/**
 * Ce que rapporte 1 point de chaque caractéristique sur un objet du niveau donné
 * (brisage naturel, coef 100 %, mode et prix courants). Sert à reconnaître en HDV
 * les lignes qui valent cher.
 */
export function useKamasParPoint(niveau: number): KamasParPoint[] {
  const ctx = useContexte();
  return useMemo(() => {
    const stats = new Set(ctx.runes.map((r) => r.statId));
    const out: KamasParPoint[] = [];
    for (const statId of stats) {
      const r = calculerBrisage({ niveau, lignes: [{ statId, jet: 100 }], coefficient: 100, focus: null }, ctx);
      if (r.valeurEsperee > 0) out.push({ statId, label: STAT_BY_ID[statId].label, kamasParPoint: r.valeurEsperee / 100 });
    }
    return out.sort((a, b) => b.kamasParPoint - a.kamasParPoint);
  }, [ctx, niveau]);
}

export function useCandidatsEvalues(): CandidatEvalue[] {
  const parId = useCatalogue((s) => s.parId);
  const ctx = useContexte();
  const { candidats, jet, kamasActuels, objectif, partBudgetTest } = useGuide();
  const budget = budgetTest(kamasActuels, partBudgetTest);
  const coefs = useNotes((s) => s.coefs);
  const prixConstates = useNotes((s) => s.prixConstates);
  const coutsCraft = useNotes((s) => s.coutsCraft);
  const taxePct = useSimu((s) => s.taxePct);

  return useMemo(() => {
    const out: CandidatEvalue[] = [];
    for (const c of candidats) {
      const item = parId.get(c.itemId);
      if (!item) continue;
      const cout = coutRetenu(prixConstates[c.itemId], coutsCraft[c.itemId]);
      const prix = cout?.prix ?? null;
      const prixDate = cout?.date ?? null;
      const dernier = dernierCoef(coefs[c.itemId]);
      const coef = dernier?.coef ?? null;
      // Crafté → jets max ; acheté → jets du réglage (moyens par défaut).
      const lignes = lignesDepuisItem(item, cout?.source === 'craft' ? 'max' : jet);
      const options = { prixRevient: prix ?? 0, taxePct, nbObjets: 1 };

      // Meilleure stratégie au coef effectif (100 % par défaut, pour la valeur repère).
      const coefEffectif = coef ?? 100;
      const base = { niveau: item.niveau, lignes, coefficient: coefEffectif, focus: null as StatId | null };
      let focus: StatId | null = null;
      let meilleur = calculerBrisage(base, ctx);
      const vus = new Set<StatId>();
      for (const l of lignes) {
        if (l.jet <= 0 || vus.has(l.statId)) continue;
        vus.add(l.statId);
        const r = calculerBrisage({ ...base, focus: l.statId }, ctx);
        if (r.valeurEsperee > meilleur.valeurEsperee) {
          meilleur = r;
          focus = l.statId;
        }
      }
      const bilan = calculerBilan(meilleur, options).espere;
      const valeur100 = coefEffectif === 100 ? meilleur.valeurEsperee : (meilleur.valeurEsperee * 100) / coefEffectif;
      const seuil = prix !== null ? coefficientSeuil({ niveau: item.niveau, lignes, focus }, ctx, options) : null;
      const benefice = coef === null ? 0 : bilan.benefice;

      let etat: EtatCandidat;
      if (c.statut === 'ecarte') etat = 'ecarte';
      else if (prix === null) etat = 'manquePrix';
      else if (budget !== null && prix > budget && coef === null) etat = 'tropCher';
      else if (coef === null) etat = 'aTester';
      else if (benefice <= 0) etat = 'perte';
      else etat = 'pret';

      const plan =
        etat === 'pret' && kamasActuels !== null && objectif !== null && prix !== null ? planifier(kamasActuels, objectif, prix, benefice) : null;

      out.push({ candidat: c, item, prix, prixDate, source: cout?.source ?? null, prixHdv: prixConstates[c.itemId]?.prix ?? null, coutCraft: coutsCraft[c.itemId]?.prix ?? null, coef, coefDate: dernier?.date ?? null, valeur100, focus, benefice, roi: coef === null ? null : bilan.roi, seuil, etat, plan });
    }
    return out;
  }, [candidats, parId, ctx, jet, coefs, prixConstates, coutsCraft, taxePct, kamasActuels, objectif, budget]);
}

/** Stratégie retenue : choix manuel s'il est encore valable, sinon le meilleur gain par cycle. */
export function strategieRetenue(evalues: CandidatEvalue[], strategieItemId: number | null): CandidatEvalue | null {
  const prets = evalues.filter((e) => e.etat === 'pret');
  if (prets.length === 0) return null;
  const manuel = prets.find((e) => e.item.id === strategieItemId);
  if (manuel) return manuel;
  return [...prets].sort(
    (a, b) => (b.plan?.gainPremierCycle ?? b.benefice) - (a.plan?.gainPremierCycle ?? a.benefice) || (b.roi ?? 0) - (a.roi ?? 0),
  )[0];
}
