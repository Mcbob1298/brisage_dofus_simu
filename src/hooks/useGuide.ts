import { useMemo } from 'react';
import type { StatId } from '../data/statMapping.ts';
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
import { niveauMaxIndicatif, useGuide, type Candidat } from '../store/guide.ts';
import { dernierCoef, useNotes } from '../store/notes.ts';
import { useSimu } from '../store/simu.ts';
import { useContexte } from './useSimulation.ts';

export type EtatCandidat = 'ecarte' | 'manquePrix' | 'tropCher' | 'aTester' | 'perte' | 'pret';

export type CandidatEvalue = {
  candidat: Candidat;
  item: Item;
  prix: number | null;
  prixDate: string | null;
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

export type Suggestion = {
  eval: EvaluationItem;
  /** Prix HDV noté, s'il existe. */
  prix: number | null;
  /** Bénéfice estimé à coef 100 % (valeur nette de taxe − prix), si prix noté. */
  beneficeEstime: number | null;
  roiEstime: number | null;
};

export type Suggestions = {
  /** Objets dont le prix noté rentre dans la bourse, classés par bénéfice estimé. */
  surMesure: Suggestion[];
  /** Objets sans prix noté, classés par densité ou valeur. */
  aChiffrer: Suggestion[];
  /** Objets écartés parce que leur prix noté dépasse la bourse. */
  nbTropChers: number;
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
  const { jet, candidats, kamasActuels, niveauMaxSuggestions, triSuggestions } = useGuide();
  const prixConstates = useNotes((s) => s.prixConstates);
  const taxePct = useSimu((s) => s.taxePct);
  const niveauMax = niveauMaxSuggestions ?? niveauMaxIndicatif(kamasActuels);
  const evaluations = useMemo(() => evaluerCatalogue(items, ctx, jet), [items, ctx, jet]);
  return useMemo(() => {
    const deja = new Set(candidats.map((c) => c.itemId));
    // Diviseur plancher à 20 : sinon les objets niveau 1 (souvent des récompenses de quête) écrasent le tri.
    const cle = (e: EvaluationItem) => (triSuggestions === 'densite' ? e.valeurMeilleure / Math.max(20, e.item.niveau) : e.valeurMeilleure);
    const eligibles = evaluations.filter(
      (e) => e.item.stats.length > 0 && e.item.droppable !== true && !e.prixManquants && !deja.has(e.item.id) && e.item.niveau <= niveauMax,
    );
    const surMesure: Suggestion[] = [];
    const aChiffrer: Suggestion[] = [];
    let nbTropChers = 0;
    for (const e of eligibles) {
      const prix = prixConstates[e.item.id]?.prix ?? null;
      if (prix === null) {
        aChiffrer.push({ eval: e, prix: null, beneficeEstime: null, roiEstime: null });
      } else if (kamasActuels !== null && prix > kamasActuels) {
        nbTropChers++;
      } else {
        const beneficeEstime = e.valeurMeilleure * (1 - taxePct / 100) - prix;
        surMesure.push({ eval: e, prix, beneficeEstime, roiEstime: prix > 0 ? (beneficeEstime / prix) * 100 : null });
      }
    }
    surMesure.sort((a, b) => b.beneficeEstime! - a.beneficeEstime!);
    aChiffrer.sort((a, b) => cle(b.eval) - cle(a.eval));
    return { surMesure, aChiffrer: aChiffrer.slice(0, limite), nbTropChers, niveauMax, auto: niveauMaxSuggestions === null };
  }, [evaluations, candidats, niveauMax, triSuggestions, limite, prixConstates, kamasActuels, taxePct, niveauMaxSuggestions]);
}

export function useCandidatsEvalues(): CandidatEvalue[] {
  const parId = useCatalogue((s) => s.parId);
  const ctx = useContexte();
  const { candidats, jet, kamasActuels, objectif } = useGuide();
  const coefs = useNotes((s) => s.coefs);
  const prixConstates = useNotes((s) => s.prixConstates);
  const taxePct = useSimu((s) => s.taxePct);

  return useMemo(() => {
    const out: CandidatEvalue[] = [];
    for (const c of candidats) {
      const item = parId.get(c.itemId);
      if (!item) continue;
      const prix = prixConstates[c.itemId]?.prix ?? null;
      const prixDate = prixConstates[c.itemId]?.date ?? null;
      const dernier = dernierCoef(coefs[c.itemId]);
      const coef = dernier?.coef ?? null;
      const lignes = lignesDepuisItem(item, jet);
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
      else if (kamasActuels !== null && prix > kamasActuels) etat = 'tropCher';
      else if (coef === null) etat = 'aTester';
      else if (benefice <= 0) etat = 'perte';
      else etat = 'pret';

      const plan =
        etat === 'pret' && kamasActuels !== null && objectif !== null && prix !== null ? planifier(kamasActuels, objectif, prix, benefice) : null;

      out.push({ candidat: c, item, prix, prixDate, coef, coefDate: dernier?.date ?? null, valeur100, focus, benefice, roi: coef === null ? null : bilan.roi, seuil, etat, plan });
    }
    return out;
  }, [candidats, parId, ctx, jet, coefs, prixConstates, taxePct, kamasActuels, objectif]);
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
