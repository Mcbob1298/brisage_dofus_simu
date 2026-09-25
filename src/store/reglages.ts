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
  /** Marge visée sur un achat, en %. */
  roiVise: number;
  poids: PoidsTable;
  mode: ModeRepartition;
  setPoids: (statId: StatId, valeur: number) => void;
  resetPoids: () => void;
  setMode: (mode: ModeRepartition) => void;
  setServeur: (serveur: string) => void;
  setCoefSuppose: (coef: number) => void;
  setRoiVise: (roi: number) => void;
};

/** Poids éditables + mode de répartition, persistés dans le navigateur. */
export const useReglages = create<EtatReglages>()(
  persist(
    (set) => ({
      serveur: 'Draconiros',
      coefSuppose: 100,
      roiVise: 30,
      poids: { ...POIDS_DEFAUT },
      mode: 'greedy',
      setPoids: (statId, valeur) => set((s) => ({ poids: { ...s.poids, [statId]: valeur } })),
      resetPoids: () => set({ poids: { ...POIDS_DEFAUT } }),
      setMode: (mode) => set({ mode }),
      setServeur: (serveur) => set({ serveur }),
      setCoefSuppose: (coefSuppose) => set({ coefSuppose: Math.max(1, coefSuppose) }),
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
          roiVise: p.roiVise ?? 30,
          poids: { ...POIDS_DEFAUT, ...(p.poids ?? {}) },
        };
      },
    },
  ),
);
