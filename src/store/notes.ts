import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type EntreeCoef = { date: string; coef: number };

type EtatNotes = {
  /** Journal des coefficients lus en jeu, par objet, trié par date croissante. */
  coefs: Record<number, EntreeCoef[]>;
  /** Prix constaté en HDV par objet (saisi à la main), en kamas. */
  prixConstates: Record<number, { prix: number; date: string }>;
  ajouterCoef: (itemId: number, coef: number, date?: string) => void;
  supprimerCoef: (itemId: number, index: number) => void;
  setPrixConstate: (itemId: number, prix: number | null) => void;
};

export const useNotes = create<EtatNotes>()(
  persist(
    (set) => ({
      coefs: {},
      prixConstates: {},
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
    }),
    { name: 'brisage.notes', version: 1 },
  ),
);

export function dernierCoef(liste: EntreeCoef[] | undefined): EntreeCoef | null {
  return liste && liste.length ? liste[liste.length - 1] : null;
}
