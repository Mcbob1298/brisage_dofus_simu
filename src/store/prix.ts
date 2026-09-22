import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RuneDef } from '../data/types.ts';
import type { PrixRunes } from '../engine/types.ts';

export type PrixEnregistre = { prix: number; date: string };

/** Format du fichier d'export : le nom est là pour la lisibilité et comme clé de secours. */
export type ExportPrix = {
  format: 'brisage-prix';
  version: 1;
  exporteLe: string;
  prix: Record<string, { nom: string; prix: number; date: string }>;
};

type EtatPrix = {
  prix: Record<number, PrixEnregistre>;
  setPrix: (runeId: number, prix: number | null) => void;
  exporter: (runes: readonly RuneDef[]) => ExportPrix;
  /** Retourne le nombre de prix importés, lève en cas de fichier invalide. */
  importer: (json: unknown, runes: readonly RuneDef[]) => number;
  toutEffacer: () => void;
};

export const useStorePrix = create<EtatPrix>()(
  persist(
    (set, get) => ({
      prix: {},
      setPrix: (runeId, prix) =>
        set((s) => {
          const suivant = { ...s.prix };
          if (prix === null || !Number.isFinite(prix) || prix < 0) delete suivant[runeId];
          else suivant[runeId] = { prix, date: new Date().toISOString() };
          return { prix: suivant };
        }),
      exporter: (runes) => {
        const out: ExportPrix = { format: 'brisage-prix', version: 1, exporteLe: new Date().toISOString(), prix: {} };
        for (const [id, p] of Object.entries(get().prix)) {
          const rune = runes.find((r) => r.id === Number(id));
          out.prix[id] = { nom: rune?.nom ?? `#${id}`, prix: p.prix, date: p.date };
        }
        return out;
      },
      importer: (json, runes) => {
        const d = json as Partial<ExportPrix>;
        if (!d || d.format !== 'brisage-prix' || typeof d.prix !== 'object' || d.prix === null) {
          throw new Error('Fichier non reconnu (attendu : export « brisage-prix »).');
        }
        const parNom = new Map(runes.map((r) => [r.nom, r.id]));
        const suivant = { ...get().prix };
        let n = 0;
        for (const [cle, v] of Object.entries(d.prix)) {
          if (typeof v?.prix !== 'number' || !Number.isFinite(v.prix)) continue;
          const id = runes.some((r) => r.id === Number(cle)) ? Number(cle) : parNom.get(v.nom);
          if (id === undefined) continue;
          suivant[id] = { prix: v.prix, date: typeof v.date === 'string' ? v.date : new Date().toISOString() };
          n++;
        }
        set({ prix: suivant });
        return n;
      },
      toutEffacer: () => set({ prix: {} }),
    }),
    { name: 'brisage.prix', version: 1 },
  ),
);

/** Vue « moteur » des prix : id → kamas. */
export function versPrixRunes(prix: Record<number, PrixEnregistre>): PrixRunes {
  const out: Partial<Record<number, number>> = {};
  for (const [id, p] of Object.entries(prix)) out[Number(id)] = p.prix;
  return out;
}

/** Au-delà de ce délai un prix est signalé comme périmé. */
export const JOURS_PERIME = 15;
