import { useMemo } from 'react';
import type { SourceCout } from '../engine/index.ts';
import { coutRetenu, useNotes } from '../store/notes.ts';

/** Coûts d'acquisition relevés à la main : le moins cher entre HDV et craft. */
export function useCouts(): Map<number, { prix: number; source: SourceCout }> {
  const prixConstates = useNotes((s) => s.prixConstates);
  const coutsCraft = useNotes((s) => s.coutsCraft);
  return useMemo(() => {
    const out = new Map<number, { prix: number; source: SourceCout }>();
    for (const id of new Set([...Object.keys(prixConstates), ...Object.keys(coutsCraft)])) {
      const itemId = Number(id);
      const c = coutRetenu(prixConstates[itemId], coutsCraft[itemId]);
      if (c) out.set(itemId, { prix: c.prix, source: c.source });
    }
    return out;
  }, [prixConstates, coutsCraft]);
}
