import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EntreeCoef = { date: string; coef: number };

type EtatNotes = {
  /** Journal des coefficients lus en jeu, par objet, trié par date croissante. */
  coefs: Record<number, EntreeCoef[]>;
  /** Prix constaté en HDV par objet (saisi à la main), en kamas. */
  prixConstates: Record<number, { prix: number; date: string }>;
  /** Coût total de craft par objet (ressources + éventuelle main-d'œuvre), en kamas. */
  coutsCraft: Record<number, { prix: number; date: string }>;
  ajouterCoef: (itemId: number, coef: number, date?: string) => void;
  supprimerCoef: (itemId: number, index: number) => void;
  setPrixConstate: (itemId: number, prix: number | null) => void;
  setCoutCraft: (itemId: number, prix: number | null) => void;
};

export type SourceCout = 'hdv' | 'craft';
export type CoutRetenu = { prix: number; source: SourceCout; date: string };

/** Le moins cher entre prix HDV et coût de craft, s'il y en a au moins un. */
export function coutRetenu(
  hdv: { prix: number; date: string } | undefined,
  craft: { prix: number; date: string } | undefined,
): CoutRetenu | null {
  if (hdv && (!craft || hdv.prix <= craft.prix)) return { prix: hdv.prix, source: 'hdv', date: hdv.date };
  if (craft) return { prix: craft.prix, source: 'craft', date: craft.date };
  return null;
}

export const useNotes = create<EtatNotes>()(
  persist(
    (set) => ({
      coefs: {},
      prixConstates: {},
      coutsCraft: {},
      ajouterCoef: (itemId, coef, date = new Date().toISOString()) =>
        set((s) => {
          const liste = [...(s.coefs[itemId] ?? []), { date, coef }].sort((a, b) => a.date.localeCompare(b.date));
          return { coefs: { ...s.coefs, [itemId]: liste } };
        }),
      supprimerCoef: (itemId, index) =>
        set((s) => {
          const liste = (s.coefs[itemId] ?? []).filter((_, i) => i !== index);
          const coefs = { ...s.coefs };
          if (liste.length) coefs[itemId] = liste;
          else delete coefs[itemId];
          return { coefs };
        }),
      setPrixConstate: (itemId, prix) =>
        set((s) => {
          const suivant = { ...s.prixConstates };
          if (prix === null || !(prix >= 0)) delete suivant[itemId];
          else suivant[itemId] = { prix, date: new Date().toISOString() };
          return { prixConstates: suivant };
        }),
      setCoutCraft: (itemId, prix) =>
        set((s) => {
          const suivant = { ...s.coutsCraft };
          if (prix === null || !(prix >= 0)) delete suivant[itemId];
          else suivant[itemId] = { prix, date: new Date().toISOString() };
          return { coutsCraft: suivant };
        }),
    }),
    {
      name: 'brisage.notes',
      version: 2,
      migrate: (persisted) => ({ coutsCraft: {}, ...(persisted as object) }),
    },
  ),
);

export function dernierCoef(liste: EntreeCoef[] | undefined): EntreeCoef | null {
  return liste && liste.length ? liste[liste.length - 1] : null;
}
