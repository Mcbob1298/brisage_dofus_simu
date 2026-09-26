import { useMemo } from 'react';
import { useCatalogue } from '../store/catalogue.ts';
import { versPrixRunes, useStorePrix } from '../store/prix.ts';
import { useReglages } from '../store/reglages.ts';
import { useSimu } from '../store/simu.ts';
import {
  calculerBilan,
  calculerBrisage,
  coefficientSeuil,
  comparerFocus,
  focalisable,
  type Bilan,
  type ComparaisonFocus,
  type Contexte,
  type EntreeBrisage,
  type OptionsBilan,
  type ResultatBrisage,
} from '../engine/index.ts';
import type { Item, RuneDef } from '../data/types.ts';
import type { StatId } from '../data/statMapping.ts';
import type { EntreeCoef } from '../store/notes.ts';
import { useCoefObjet } from './useCoefficients.ts';

export type Simulation = {
  item: Item;
  /** Relevé au concasseur utilisé, `null` si on tient l'hypothèse globale. */
  coefReleve: EntreeCoef | null;
  entree: EntreeBrisage;
  options: OptionsBilan;
  ctx: Contexte;
  resultat: ResultatBrisage;
  bilan: Bilan;
  seuil: number | null;
};

/** Contexte moteur (poids, runes, prix, mode) — stable tant que rien ne change. */
export function useContexte(): Contexte {
  const runes = useCatalogue((s) => s.runes);
  const prixStore = useStorePrix((s) => s.prix);
  const poids = useReglages((s) => s.poids);
  const mode = useReglages((s) => s.mode);
  const prix = useMemo(() => versPrixRunes(prixStore), [prixStore]);
  return useMemo(() => ({ poids, runes, prix, mode }), [poids, runes, prix, mode]);
}

export function useSimulation(): Simulation | null {
  const parId = useCatalogue((s) => s.parId);
  const { itemId, lignes, prixRevient, nbObjets, taxePct, focus } = useSimu();
  const ctx = useContexte();
  const item = itemId !== null ? parId.get(itemId) : undefined;
  // Le coefficient suit l'objet : changer d'objet change de coefficient.
  const { coef: coefficient, releve } = useCoefObjet(itemId);

  return useMemo(() => {
    if (!item) return null;
    const entree: EntreeBrisage = {
      niveau: item.niveau,
      lignes: lignes.map((l) => ({ statId: l.statId, jet: l.jet })),
      coefficient,
      focus,
    };
    const options: OptionsBilan = { prixRevient, taxePct, nbObjets };
    const resultat = calculerBrisage(entree, ctx);
    const bilan = calculerBilan(resultat, options);
    const seuil = coefficientSeuil(entree, ctx, options);
    return { item, coefReleve: releve, entree, options, ctx, resultat, bilan, seuil };
  }, [item, lignes, coefficient, releve, focus, prixRevient, taxePct, nbObjets, ctx]);
}

export function useComparaisonFocus(sim: Simulation | null): ComparaisonFocus[] {
  return useMemo(() => (sim ? comparerFocus(sim.entree, sim.ctx, sim.options) : []), [sim]);
}

export type DetailLigne = {
  statId: StatId;
  /** Jet retenu sur cette ligne. */
  jet: number;
  min: number;
  max: number;
  /** Rune simple de la caractéristique, pour l'icône et le prix. */
  rune: RuneDef | null;
  prixRune: number | undefined;
  sansFocus: { runes: number; kamas: number };
  /** Ce que rendrait l'objet en focalisant cette ligne (les autres sont détruites). */
  avecFocus: { runes: number; kamas: number };
};

/**
 * Détail ligne par ligne : ce que rend chaque caractéristique en brisage naturel
 * et ce qu'elle rendrait si on focalisait dessus. Les deux colonnes se comparent
 * directement, comme sur une fiche d'objet.
 */
export function useDetailLignes(sim: Simulation | null): DetailLigne[] {
  const lignes = useSimu((s) => s.lignes);
  return useMemo(() => {
    if (!sim) return [];
    const { ctx, entree } = sim;
    const naturel = calculerBrisage({ ...entree, focus: null }, ctx);
    return lignes.map((l): DetailLigne => {
      const rune = ctx.runes.find((r) => r.statId === l.statId && r.tier === 'simple') ?? null;
      const prixRune = rune ? ctx.prix[rune.id] : undefined;
      const sans = naturel.parStat.find((p) => p.statId === l.statId);
      const utile = focalisable(l.jet);
      const avec = utile ? calculerBrisage({ ...entree, focus: l.statId }, ctx).parStat.find((p) => p.statId === l.statId) : undefined;
      const quantite = (points: number | undefined) => (points !== undefined && rune ? points / rune.valeur : 0);
      return {
        statId: l.statId,
        jet: l.jet,
        min: l.min,
        max: l.max,
        rune,
        prixRune,
        sansFocus: { runes: quantite(sans?.points), kamas: sans?.valeurEsperee ?? 0 },
        avecFocus: { runes: quantite(avec?.points), kamas: avec?.valeurEsperee ?? 0 },
      };
    });
  }, [sim, lignes]);
}
