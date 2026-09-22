import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PRESETS, type Poids } from '../engine/build.ts';
import type { JetChoisi } from '../engine/explorateur.ts';

type EtatPerso = {
  /** Poids de l'objectif d'équipement (préréglage ou valeurs modifiées). */
  poids: Poids;
  jet: JetChoisi;
  /** Objets imposés : ceux qu'on possède déjà ou qu'on a choisis à la main. */
  epingles: number[];
  setPoids: (poids: Poids) => void;
  setJet: (jet: JetChoisi) => void;
  basculerEpingle: (itemId: number) => void;
  ajouterEpingle: (itemId: number) => void;
  retirerEpingle: (itemId: number) => void;
  reset: () => void;
};

const initial = { poids: PRESETS[0].poids, jet: 'moyen' as JetChoisi, epingles: [] as number[] };

export const usePerso = create<EtatPerso>()(
  persist(
    (set) => ({
      ...initial,
      setPoids: (poids) => set({ poids }),
      setJet: (jet) => set({ jet }),
      basculerEpingle: (itemId) =>
        set((s) => ({ epingles: s.epingles.includes(itemId) ? s.epingles.filter((i) => i !== itemId) : [...s.epingles, itemId] })),
      ajouterEpingle: (itemId) => set((s) => (s.epingles.includes(itemId) ? {} : { epingles: [...s.epingles, itemId] })),
      retirerEpingle: (itemId) => set((s) => ({ epingles: s.epingles.filter((i) => i !== itemId) })),
      reset: () => set({ ...initial }),
    }),
    { name: 'brisage.perso', version: 1 },
  ),
);
