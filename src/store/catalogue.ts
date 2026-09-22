import { create } from 'zustand';
import type { CatalogueMeta, Item, RuneDef } from '../data/types.ts';
import { IndexRecherche } from '../search/index.ts';

type Statut = 'idle' | 'chargement' | 'pret' | 'erreur';

type EtatCatalogue = {
  statut: Statut;
  erreur: string | null;
  items: Item[];
  parId: Map<number, Item>;
  runes: RuneDef[];
  meta: CatalogueMeta | null;
  index: IndexRecherche | null;
  charger: () => Promise<void>;
};

async function lireJson<T>(chemin: string): Promise<T> {
  const res = await fetch(chemin);
  if (!res.ok) throw new Error(`${chemin} : HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** Catalogue statique servi depuis public/data (aucun appel externe). */
export const useCatalogue = create<EtatCatalogue>((set, get) => ({
  statut: 'idle',
  erreur: null,
  items: [],
  parId: new Map(),
  runes: [],
  meta: null,
  index: null,
  charger: async () => {
    if (get().statut !== 'idle') return;
    set({ statut: 'chargement' });
    try {
      const [items, runes, meta] = await Promise.all([
        lireJson<Item[]>('/data/items.json'),
        lireJson<RuneDef[]>('/data/runes.json'),
        lireJson<CatalogueMeta>('/data/meta.json').catch(() => null),
      ]);
      set({
        statut: 'pret',
        items,
        parId: new Map(items.map((i) => [i.id, i])),
        runes,
        meta,
        index: new IndexRecherche(items),
      });
    } catch (e) {
      set({ statut: 'erreur', erreur: (e as Error).message });
    }
  },
}));
