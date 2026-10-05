import { useMemo } from 'react';
import type { Item } from '../data/types.ts';
import { calibrer, estimerPrix, type Calibration, type Estimation } from '../engine/index.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { useCouts } from './useCouts.ts';

export type Estimateur = {
  calibration: Calibration;
  /** Coût réel (saisi, relevé HDV ou craft), sinon `null`. */
  coutNote: (item: Item) => number | null;
  /** Estimation, uniquement si aucun prix n'a été noté pour cet objet. */
  estimer: (item: Item) => Estimation | null;
  /** Coût à utiliser : noté s'il existe, sinon estimé, sinon `null`. */
  cout: (item: Item) => { prix: number; estime: boolean } | null;
};

/**
 * Prix des équipements : le prix réel quand on en a un, sinon une estimation.
 *
 * Les prix réels viennent de `useCouts` — tes saisies, le relevé HDV et tes
 * coûts de craft — comme partout ailleurs dans l'app. L'estimation par niveau
 * ne sert plus qu'aux objets absents de ces trois sources, et elle est calibrée
 * sur tous ces prix réels au lieu de tes seules saisies.
 */
export function useEstimation(): Estimateur {
  const parId = useCatalogue((s) => s.parId);
  const couts = useCouts();

  return useMemo(() => {
    const notes = new Map<number, number>();
    for (const [itemId, c] of couts) notes.set(itemId, c.prix);
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
  }, [parId, couts]);
}
