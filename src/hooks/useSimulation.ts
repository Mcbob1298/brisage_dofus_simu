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
  type Bilan,
  type ComparaisonFocus,
  type Contexte,
  type EntreeBrisage,
  type OptionsBilan,
  type ResultatBrisage,
} from '../engine/index.ts';
import type { Item } from '../data/types.ts';

export type Simulation = {
  item: Item;
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
  const { itemId, lignes, coefficient, prixRevient, nbObjets, taxePct, focus } = useSimu();
  const ctx = useContexte();
  const item = itemId !== null ? parId.get(itemId) : undefined;

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
    return { item, entree, options, ctx, resultat, bilan, seuil };
  }, [item, lignes, coefficient, focus, prixRevient, taxePct, nbObjets, ctx]);
}

export function useComparaisonFocus(sim: Simulation | null): ComparaisonFocus[] {
  return useMemo(() => (sim ? comparerFocus(sim.entree, sim.ctx, sim.options) : []), [sim]);
}
