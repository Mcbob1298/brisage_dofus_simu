import { useMemo } from 'react';
import type { SourceCout } from '../engine/index.ts';
import { coutRetenu, useNotes } from '../store/notes.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { useReglages } from '../store/reglages.ts';
import { hdvUtilisable, indexerHdv } from '../lib/hdv.ts';

export type Cout = {
  prix: number;
  source: SourceCout;
  /** Vrai si le prix HDV vient du relevé automatique, faux si tu l'as saisi. */
  releve: boolean;
  /** Exemplaires en vente à ce prix, `null` si la source ne le dit pas. */
  disponible: number | null;
  date: string | null;
};

/**
 * Coût d'acquisition par objet : le moins cher entre l'achat en HDV et le craft.
 *
 * Trois sources, dans cet ordre de priorité pour le prix HDV :
 *  1. ta saisie manuelle — tu l'as vu de tes yeux, elle prime toujours ;
 *  2. le relevé automatique (`public/data/prix-hdv.json`), ignoré s'il ne
 *     concerne pas le serveur sélectionné ;
 *  3. rien, et l'objet reste sans prix plutôt que d'en recevoir un inventé.
 */
export function useCouts(): Map<number, Cout> {
  const prixConstates = useNotes((s) => s.prixConstates);
  const coutsCraft = useNotes((s) => s.coutsCraft);
  const prixHdv = useCatalogue((s) => s.prixHdv);
  const serveur = useReglages((s) => s.serveur);

  return useMemo(() => {
    const releves = hdvUtilisable(prixHdv, serveur) ? indexerHdv(prixHdv) : new Map();
    const out = new Map<number, Cout>();
    const ids = new Set<number>([
      ...Object.keys(prixConstates).map(Number),
      ...Object.keys(coutsCraft).map(Number),
      ...releves.keys(),
    ]);

    for (const itemId of ids) {
      const saisi = prixConstates[itemId];
      const offre = releves.get(itemId);
      const hdv = saisi ?? (offre ? { prix: offre.prixUnitaire, date: offre.releveLe ?? prixHdv!.releveLe } : undefined);
      const c = coutRetenu(hdv, coutsCraft[itemId]);
      if (!c) continue;
      const vientDuReleve = c.source === 'hdv' && saisi === undefined;
      out.set(itemId, {
        prix: c.prix,
        source: c.source,
        releve: vientDuReleve,
        // La disponibilité ne vaut que pour l'achat en HDV au prix relevé : un
        // craft n'est pas limité par le marché de l'objet fini.
        disponible: vientDuReleve ? (offre?.disponible ?? null) : null,
        date: c.date,
      });
    }
    return out;
  }, [prixConstates, coutsCraft, prixHdv, serveur]);
}
