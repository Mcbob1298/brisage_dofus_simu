import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StatId } from '../data/statMapping.ts';
import { POIDS_DEFAUT, type PoidsTable } from '../engine/poids.ts';
import type { ModeRepartition } from '../engine/types.ts';

type EtatReglages = {
  /** Serveur de jeu : les prix relevés lui sont propres. */
  serveur: string;
  /** Coefficient supposé au concasseur, pour estimer avant d'avoir testé. */
  coefSuppose: number;
  /**
   * Vrai dès que l'utilisateur a fixé ce coefficient lui-même. Tant qu'il est
   * faux, la médiane de ses propres relevés prime (cf. `useCoefSuppose`) : une
   * constante à 100 % n'est pas une hypothèse neutre.
   */
  coefSupposeChoisi: boolean;
  /** Marge visée sur un achat, en %. */
  roiVise: number;
  poids: PoidsTable;
  mode: ModeRepartition;
  setPoids: (statId: StatId, valeur: number) => void;
  resetPoids: () => void;
  setMode: (mode: ModeRepartition) => void;
  setServeur: (serveur: string) => void;
  setCoefSuppose: (coef: number) => void;
  /** Revenir à la médiane des relevés après un réglage manuel. */
  reprendreMedianeMesuree: () => void;
  setRoiVise: (roi: number) => void;
};

/** Poids éditables + mode de répartition, persistés dans le navigateur. */
export const useReglages = create<EtatReglages>()(
  persist(
    (set) => ({
      serveur: 'Draconiros',
      coefSuppose: 100,
      coefSupposeChoisi: false,
      roiVise: 30,
      poids: { ...POIDS_DEFAUT },
      mode: 'greedy',
      setPoids: (statId, valeur) => set((s) => ({ poids: { ...s.poids, [statId]: valeur } })),
      resetPoids: () => set({ poids: { ...POIDS_DEFAUT } }),
      setMode: (mode) => set({ mode }),
      setServeur: (serveur) => set({ serveur }),
      setCoefSuppose: (coefSuppose) => set({ coefSuppose: Math.max(1, coefSuppose), coefSupposeChoisi: true }),
      reprendreMedianeMesuree: () => set({ coefSupposeChoisi: false }),
      setRoiVise: (roiVise) => set({ roiVise: Math.max(0, roiVise) }),
    }),
    {
      name: 'brisage.reglages',
      version: 1,
      // Une stat ajoutée au référentiel après coup récupère son poids par défaut.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<EtatReglages>;
        return {
          ...current,
          ...p,
          serveur: p.serveur ?? 'Draconiros',
          coefSuppose: p.coefSuppose ?? 100,
          coefSupposeChoisi: p.coefSupposeChoisi ?? false,
          roiVise: p.roiVise ?? 30,
          poids: { ...POIDS_DEFAUT, ...(p.poids ?? {}) },
        };
      },
    },
  ),
);
