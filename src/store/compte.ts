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
  setBudget: (v: number) => void;
  setNiveau: (v: number) => void;
  setProspection: (v: number) => void;
  setRoiMin: (v: number) => void;
};

export const useCompte = create<EtatCompte>()(
  persist(
    (set) => ({
      budget: 0,
      niveau: 50,
      prospection: 100,
      roiMin: 20,
      setBudget: (budget) => set({ budget: Math.max(0, budget) }),
      setNiveau: (niveau) => set({ niveau: Math.min(200, Math.max(1, Math.round(niveau))) }),
      setProspection: (prospection) => set({ prospection: Math.max(0, Math.round(prospection)) }),
      setRoiMin: (roiMin) => set({ roiMin: Math.max(0, roiMin) }),
    }),
    { name: 'brisage.compte', version: 1 },
  ),
);
