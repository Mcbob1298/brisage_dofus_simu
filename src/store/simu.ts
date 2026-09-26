import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { StatId } from '../data/statMapping.ts';
import type { Item } from '../data/types.ts';

export type JetMode = 'min' | 'moyen' | 'max';

export type LigneSimu = {
  statId: StatId;
  min: number;
  max: number;
  jet: number;
  /** Jet saisi à la main (ne suit plus le sélecteur global). */
  modifie: boolean;
};

export function jetSelon(mode: JetMode, min: number, max: number): number {
  if (mode === 'min') return min;
  if (mode === 'max') return max;
  return Math.round((min + max) / 2);
}

type EtatSimu = {
  itemId: number | null;
  lignes: LigneSimu[];
  jetMode: JetMode;
  // Pas de coefficient ici : c'est une donnée de l'objet, tenue par le journal
  // des relevés (`useNotes.coefs`), sinon elle survivrait au changement d'objet.
  prixRevient: number;
  nbObjets: number;
  taxePct: number;
  focus: StatId | null;
  choisirObjet: (item: Item) => void;
  setJetMode: (mode: JetMode) => void;
  setJet: (index: number, jet: number) => void;
  resetLignes: () => void;
  setFocus: (statId: StatId | null) => void;
  setChamp: (champ: 'prixRevient' | 'nbObjets' | 'taxePct', valeur: number) => void;
};

export const useSimu = create<EtatSimu>()(
  persist(
    (set, get) => ({
      itemId: null,
      lignes: [],
      jetMode: 'max',
      prixRevient: 0,
      nbObjets: 1,
      // Taxe de mise en vente à l'hôtel des ventes (réglable).
      taxePct: 2,
      focus: null,
      choisirObjet: (item) => {
        const mode = get().jetMode;
        set({
          itemId: item.id,
          lignes: item.stats.map((s) => ({ ...s, jet: jetSelon(mode, s.min, s.max), modifie: false })),
          focus: null,
        });
      },
      setJetMode: (jetMode) =>
        set((s) => ({
          jetMode,
          lignes: s.lignes.map((l) => (l.modifie ? l : { ...l, jet: jetSelon(jetMode, l.min, l.max) })),
        })),
      setJet: (index, jet) =>
        set((s) => ({
          lignes: s.lignes.map((l, i) => (i === index ? { ...l, jet, modifie: true } : l)),
        })),
      resetLignes: () =>
        set((s) => ({
          lignes: s.lignes.map((l) => ({ ...l, jet: jetSelon(s.jetMode, l.min, l.max), modifie: false })),
        })),
      setFocus: (focus) => set({ focus }),
      setChamp: (champ, valeur) => set({ [champ]: valeur }),
    }),
    {
      name: 'brisage.simu',
      version: 2,
      // v1 gardait un `coefficient` global ici. Il n'est pas récupérable en
      // relevé (on ne sait pas de quel objet il venait) : on l'abandonne.
      migrate: (p) => {
        const { coefficient: _abandonne, ...reste } = (p ?? {}) as Record<string, unknown>;
        return reste;
      },
    },
  ),
);
