import { useMemo } from 'react';
import { dernierCoef, useNotes } from '../store/notes.ts';

/** Dernier coefficient relevé au concasseur, par objet. */
export function useCoefficients(): Map<number, number> {
  const coefs = useNotes((s) => s.coefs);
  return useMemo(() => {
    const out = new Map<number, number>();
    for (const [id, liste] of Object.entries(coefs)) {
      const dernier = dernierCoef(liste);
      if (dernier) out.set(Number(id), dernier.coef);
    }
    return out;
  }, [coefs]);
}
