import { useMemo } from 'react';
import type { Item } from '../data/types.ts';
import { calibrer, estimerPrix, type Calibration, type Estimation } from '../engine/index.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { coutRetenu, useNotes } from '../store/notes.ts';

export type Estimateur = {
  calibration: Calibration;
  /** Coût réellement noté (HDV ou craft), sinon `null`. */
  coutNote: (item: Item) => number | null;
  /** Estimation, uniquement si aucun prix n'a été noté pour cet objet. */
  estimer: (item: Item) => Estimation | null;
  /** Coût à utiliser : noté s'il existe, sinon estimé, sinon `null`. */
  cout: (item: Item) => { prix: number; estime: boolean } | null;
};

/** Estimation des prix d'équipement à partir des prix que l'utilisateur a relevés. */
export function useEstimation(): Estimateur {
  const parId = useCatalogue((s) => s.parId);
  const prixConstates = useNotes((s) => s.prixConstates);
  const coutsCraft = useNotes((s) => s.coutsCraft);

  return useMemo(() => {
    const notes = new Map<number, number>();
    for (const id of new Set([...Object.keys(prixConstates), ...Object.keys(coutsCraft)])) {
      const itemId = Number(id);
      const c = coutRetenu(prixConstates[itemId], coutsCraft[itemId]);
      if (c) notes.set(itemId, c.prix);
    }
    const releves = [...notes.entries()].flatMap(([itemId, prix]) => {
      const item = parId.get(itemId);
      return item ? [{ niveau: item.niveau, type: item.type, prix }] : [];
    });
    const calibration = calibrer(releves);
    const coutNote = (item: Item) => notes.get(item.id) ?? null;
    const estimer = (item: Item) => (notes.has(item.id) ? null : estimerPrix(item, calibration));
    return {
      calibration,
      coutNote,
      estimer,
      cout: (item: Item) => {
        const note = coutNote(item);
        if (note !== null) return { prix: note, estime: false };
        const est = estimerPrix(item, calibration);
        return est ? { prix: est.prix, estime: true } : null;
      },
    };
  }, [parId, prixConstates, coutsCraft]);
}
