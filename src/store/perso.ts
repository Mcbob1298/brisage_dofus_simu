import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Element } from '../engine/build.ts';
import type { JetChoisi } from '../engine/explorateur.ts';

export type Objectif = 'prospection' | 'degats' | 'mixte';

type EtatPerso = {
  /** Classe du personnage (id DofusDB), repère d'affichage. */
  classeId: number | null;
  /** Voie élémentaire visée : oriente les poids du stuff. */
  element: Element;
  objectif: Objectif;
  jet: JetChoisi;
  /** Chance hors équipement : points de caractéristique investis + parchemins. */
  chanceBase: number;
  /** Objets imposés : ceux qu'on possède déjà ou qu'on a choisis à la main. */
  epingles: number[];
  setClasse: (id: number | null) => void;
  setElement: (e: Element) => void;
  setObjectif: (o: Objectif) => void;
  setJet: (jet: JetChoisi) => void;
  setChanceBase: (n: number) => void;
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
  chanceBase: 0,
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
      setChanceBase: (chanceBase) => set({ chanceBase: Math.max(0, Math.round(chanceBase)) }),
      basculerEpingle: (itemId) =>
        set((s) => ({ epingles: s.epingles.includes(itemId) ? s.epingles.filter((i) => i !== itemId) : [...s.epingles, itemId] })),
      ajouterEpingle: (itemId) => set((s) => (s.epingles.includes(itemId) ? {} : { epingles: [...s.epingles, itemId] })),
      retirerEpingle: (itemId) => set((s) => ({ epingles: s.epingles.filter((i) => i !== itemId) })),
      reset: () => set({ ...initial }),
    }),
    { name: 'brisage.perso', version: 3, migrate: (p) => ({ ...initial, ...(p as object) }) },
  ),
);
