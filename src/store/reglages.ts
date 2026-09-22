import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StatId } from '../data/statMapping.ts';
import { POIDS_DEFAUT, type PoidsTable } from '../engine/poids.ts';
import type { ModeRepartition } from '../engine/types.ts';

type EtatReglages = {
  poids: PoidsTable;
  mode: ModeRepartition;
  setPoids: (statId: StatId, valeur: number) => void;
  resetPoids: () => void;
  setMode: (mode: ModeRepartition) => void;
};

/** Poids éditables + mode de répartition, persistés dans le navigateur. */
export const useReglages = create<EtatReglages>()(
  persist(
    (set) => ({
      poids: { ...POIDS_DEFAUT },
      mode: 'greedy',
      setPoids: (statId, valeur) => set((s) => ({ poids: { ...s.poids, [statId]: valeur } })),
      resetPoids: () => set({ poids: { ...POIDS_DEFAUT } }),
      setMode: (mode) => set({ mode }),
    }),
    {
      name: 'brisage.reglages',
      version: 1,
      // Une stat ajoutée au référentiel après coup récupère son poids par défaut.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<EtatReglages>;
        return { ...current, ...p, poids: { ...POIDS_DEFAUT, ...(p.poids ?? {}) } };
      },
    },
  ),
);
