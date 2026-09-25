import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type EtatCompte = {
  /** Somme qu'on accepte d'engager dans du brisage, en kamas. */
  budget: number;
  /** Niveau du personnage : conditionne les monstres et les drops accessibles. */
  niveau: number;
  /** Prospection totale telle qu'affichée en jeu (elle inclut déjà la chance). */
  prospection: number;
  /** Marge minimale exigée pour qu'un objet soit recommandé, en %. */
  roiMin: number;
  /** Part du budget qu'un seul exemplaire peut coûter sans alerte, en %. */
  partRisque: number;
  /** Objets suivis, à garder sous la main au concasseur. */
  favoris: number[];
  setBudget: (v: number) => void;
  setNiveau: (v: number) => void;
  setProspection: (v: number) => void;
  setRoiMin: (v: number) => void;
  setPartRisque: (v: number) => void;
  basculerFavori: (itemId: number) => void;
};

export const useCompte = create<EtatCompte>()(
  persist(
    (set) => ({
      budget: 0,
      niveau: 50,
      prospection: 100,
      roiMin: 20,
      partRisque: 5,
      favoris: [],
      setBudget: (budget) => set({ budget: Math.max(0, budget) }),
      setNiveau: (niveau) => set({ niveau: Math.min(200, Math.max(1, Math.round(niveau))) }),
      setProspection: (prospection) => set({ prospection: Math.max(0, Math.round(prospection)) }),
      setRoiMin: (roiMin) => set({ roiMin: Math.max(0, roiMin) }),
      setPartRisque: (partRisque) => set({ partRisque: Math.min(100, Math.max(1, partRisque)) }),
      basculerFavori: (itemId) =>
        set((s) => ({ favoris: s.favoris.includes(itemId) ? s.favoris.filter((i) => i !== itemId) : [...s.favoris, itemId] })),
    }),
    {
      name: 'brisage.compte',
      version: 2,
      migrate: (p) => ({ budget: 0, niveau: 50, prospection: 100, roiMin: 20, partRisque: 5, favoris: [], ...(p as object) }),
    },
  ),
);
