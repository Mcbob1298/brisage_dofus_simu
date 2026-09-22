import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Element, StatsBase } from '../engine/build.ts';
import type { JetChoisi } from '../engine/explorateur.ts';

export type Objectif = 'prospection' | 'degats' | 'mixte';

type EtatPerso = {
  /** Classe du personnage (id DofusDB), repère d'affichage. */
  classeId: number | null;
  /** Voie élémentaire visée : oriente les poids du stuff. */
  element: Element;
  objectif: Objectif;
  jet: JetChoisi;
  /**
   * Caractéristiques du personnage hors équipement, telles qu'affichées en jeu
   * (points investis, parchemins, bonus) : aucune API ne les connaît.
   */
  base: StatsBase;
  /** Objets imposés : ceux qu'on possède déjà ou qu'on a choisis à la main. */
  epingles: number[];
  setClasse: (id: number | null) => void;
  setElement: (e: Element) => void;
  setObjectif: (o: Objectif) => void;
  setJet: (jet: JetChoisi) => void;
  setBase: (statId: keyof StatsBase, valeur: number | null) => void;
  basculerEpingle: (itemId: number) => void;
  ajouterEpingle: (itemId: number) => void;
  retirerEpingle: (itemId: number) => void;
  reset: () => void;
};

const initial = {
  classeId: null,
  element: 'terre' as Element,
  objectif: 'prospection' as Objectif,
  jet: 'moyen' as JetChoisi,
  base: {} as StatsBase,
  epingles: [] as number[],
};

export const usePerso = create<EtatPerso>()(
  persist(
    (set) => ({
      ...initial,
      setClasse: (classeId) => set({ classeId }),
      setElement: (element) => set({ element }),
      setObjectif: (objectif) => set({ objectif }),
      setJet: (jet) => set({ jet }),
      setBase: (statId, valeur) =>
        set((s) => {
          const base = { ...s.base };
          if (valeur === null || !Number.isFinite(valeur)) delete base[statId];
          else base[statId] = Math.max(0, Math.round(valeur));
          return { base };
        }),
      basculerEpingle: (itemId) =>
        set((s) => ({ epingles: s.epingles.includes(itemId) ? s.epingles.filter((i) => i !== itemId) : [...s.epingles, itemId] })),
      ajouterEpingle: (itemId) => set((s) => (s.epingles.includes(itemId) ? {} : { epingles: [...s.epingles, itemId] })),
      retirerEpingle: (itemId) => set((s) => ({ epingles: s.epingles.filter((i) => i !== itemId) })),
      reset: () => set({ ...initial }),
    }),
    {
      name: 'brisage.perso',
      version: 4,
      // v3 ne gardait que la chance : on la reverse dans les caractéristiques de base.
      migrate: (p) => {
        const a = (p ?? {}) as { chanceBase?: number; base?: StatsBase };
        return { ...initial, ...a, base: a.base ?? (a.chanceBase ? { chance: a.chanceBase } : {}) };
      },
    },
  ),
);
