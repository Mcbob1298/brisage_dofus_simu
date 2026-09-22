import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StatutCandidat = 'aTester' | 'ecarte';

export type Candidat = {
  itemId: number;
  ajouteLe: string;
  statut: StatutCandidat;
};

export type Session = {
  id: string;
  date: string;
  itemId: number;
  nbObjets: number;
  /** Kamas nets gagnés (ventes − achats) sur la session ; peut être négatif. */
  gain: number;
};

export type PointKamas = { date: string; kamas: number };

export type JetGuide = 'min' | 'moyen' | 'max';
export type TriSuggestions = 'densite' | 'valeur';

/** Part de la bourse qu'un seul test peut consommer, par défaut (en %). */
export const PART_BUDGET_TEST_DEFAUT = 20;

/** Budget maximal d'un test : on ne mise jamais toute la bourse sur un seul objet à tester. */
export function budgetTest(kamas: number | null, partPct: number): number | null {
  return kamas === null ? null : Math.floor((kamas * partPct) / 100);
}

/**
 * Tranche de niveau indicative selon la bourse. L'app ne connaît pas les prix
 * HDV : le niveau est le seul proxy de prix disponible, et cette règle n'est
 * qu'un point de départ modifiable d'un clic.
 */
export function niveauMaxIndicatif(kamas: number | null): number {
  if (kamas === null || kamas < 100_000) return 60;
  if (kamas < 500_000) return 120;
  if (kamas < 2_000_000) return 160;
  return 200;
}

type EtatGuide = {
  kamasActuels: number | null;
  objectif: number | null;
  /** Jets supposés des objets achetés : « moyen » est prudent pour de l'HDV. */
  jet: JetGuide;
  candidats: Candidat[];
  /** Part de la bourse (en %) qu'un test peut consommer. */
  partBudgetTest: number;
  /** Niveau max des suggestions, null = indicatif selon la bourse. */
  niveauMaxSuggestions: number | null;
  triSuggestions: TriSuggestions;
  /** Objet retenu comme stratégie (null = meilleur automatique). */
  strategieItemId: number | null;
  sessions: Session[];
  historiqueKamas: PointKamas[];
  setKamas: (kamas: number | null) => void;
  setObjectif: (objectif: number | null) => void;
  setJet: (jet: JetGuide) => void;
  setPartBudgetTest: (pct: number) => void;
  setNiveauMaxSuggestions: (n: number | null) => void;
  setTriSuggestions: (t: TriSuggestions) => void;
  ajouterCandidat: (itemId: number) => void;
  retirerCandidat: (itemId: number) => void;
  setStatut: (itemId: number, statut: StatutCandidat) => void;
  retenir: (itemId: number | null) => void;
  ajouterSession: (s: Omit<Session, 'id'>) => void;
  supprimerSession: (id: string) => void;
  reinitialiser: () => void;
};

const etatInitial = {
  kamasActuels: null,
  objectif: null,
  jet: 'moyen' as JetGuide,
  candidats: [] as Candidat[],
  partBudgetTest: PART_BUDGET_TEST_DEFAUT,
  niveauMaxSuggestions: null as number | null,
  triSuggestions: 'densite' as TriSuggestions,
  strategieItemId: null,
  sessions: [] as Session[],
  historiqueKamas: [] as PointKamas[],
};

export const useGuide = create<EtatGuide>()(
  persist(
    (set) => ({
      ...etatInitial,
      setKamas: (kamas) =>
        set((s) => ({
          kamasActuels: kamas,
          historiqueKamas:
            kamas === null ? s.historiqueKamas : [...s.historiqueKamas, { date: new Date().toISOString(), kamas }],
        })),
      setObjectif: (objectif) => set({ objectif }),
      setJet: (jet) => set({ jet }),
      setPartBudgetTest: (partBudgetTest) => set({ partBudgetTest: Math.min(100, Math.max(1, partBudgetTest)) }),
      setNiveauMaxSuggestions: (niveauMaxSuggestions) => set({ niveauMaxSuggestions }),
      setTriSuggestions: (triSuggestions) => set({ triSuggestions }),
      ajouterCandidat: (itemId) =>
        set((s) =>
          s.candidats.some((c) => c.itemId === itemId)
            ? { candidats: s.candidats.map((c) => (c.itemId === itemId ? { ...c, statut: 'aTester' } : c)) }
            : { candidats: [...s.candidats, { itemId, ajouteLe: new Date().toISOString(), statut: 'aTester' }] },
        ),
      retirerCandidat: (itemId) =>
        set((s) => ({
          candidats: s.candidats.filter((c) => c.itemId !== itemId),
          strategieItemId: s.strategieItemId === itemId ? null : s.strategieItemId,
        })),
      setStatut: (itemId, statut) =>
        set((s) => ({ candidats: s.candidats.map((c) => (c.itemId === itemId ? { ...c, statut } : c)) })),
      retenir: (itemId) => set({ strategieItemId: itemId }),
      ajouterSession: (sess) =>
        set((s) => {
          const kamas = (s.kamasActuels ?? 0) + sess.gain;
          return {
            sessions: [...s.sessions, { ...sess, id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }],
            kamasActuels: kamas,
            historiqueKamas: [...s.historiqueKamas, { date: sess.date, kamas }],
          };
        }),
      supprimerSession: (id) =>
        set((s) => {
          const sess = s.sessions.find((x) => x.id === id);
          if (!sess) return {};
          return {
            sessions: s.sessions.filter((x) => x.id !== id),
            kamasActuels: s.kamasActuels === null ? null : s.kamasActuels - sess.gain,
          };
        }),
      reinitialiser: () => set({ ...etatInitial }),
    }),
    {
      name: 'brisage.guide',
      version: 2,
      migrate: (persisted) => ({ partBudgetTest: PART_BUDGET_TEST_DEFAUT, ...(persisted as object) }),
    },
  ),
);
