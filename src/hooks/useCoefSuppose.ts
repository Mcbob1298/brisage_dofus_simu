import { useMemo } from 'react';
import { dernierCoef, useNotes } from '../store/notes.ts';
import { useReglages } from '../store/reglages.ts';
import { mediane, MIN_RELEVES } from '../engine/estimation.ts';

export type CoefSuppose = {
  /** Coefficient appliqué aux objets jamais testés. */
  valeur: number;
  /** D'où il sort : de tes propres relevés, ou du réglage manuel. */
  source: 'mesures' | 'reglage';
  /** Nombre d'objets sur lesquels la médiane est calculée. */
  nbReleves: number;
  /** Médiane de tes relevés, même quand elle ne sert pas. `null` si trop peu. */
  medianeMesuree: number | null;
};

/**
 * Coefficient à appliquer aux objets qu'on n'a jamais testés au concasseur.
 *
 * Il valait 100 % par défaut, ce qui n'est pas neutre : c'est une hypothèse
 * haute, et elle multipliait par trois ou quatre la rentabilité annoncée de
 * tout le catalogue dès qu'on a des prix pour 3 000 objets. Les relevés de
 * Mathias sur Draconiros tournaient entre 15 et 72 %.
 *
 * Dès qu'il existe assez de relevés, on prend donc leur MÉDIANE plutôt qu'une
 * constante : la meilleure estimation pour un objet inconnu, c'est ce qu'on
 * observe sur les objets connus. Le réglage manuel reste disponible et reprend
 * la main s'il est modifié.
 */
export function useCoefSuppose(): CoefSuppose {
  const coefs = useNotes((s) => s.coefs);
  const coefSuppose = useReglages((s) => s.coefSuppose);
  const coefSupposeChoisi = useReglages((s) => s.coefSupposeChoisi);

  return useMemo(() => {
    const derniers: number[] = [];
    for (const liste of Object.values(coefs)) {
      const d = dernierCoef(liste);
      if (d && d.coef > 0) derniers.push(d.coef);
    }
    const med = derniers.length >= MIN_RELEVES ? mediane(derniers) : null;
    if (med === null || coefSupposeChoisi) {
      return { valeur: coefSuppose, source: 'reglage', nbReleves: derniers.length, medianeMesuree: med };
    }
    return { valeur: med, source: 'mesures', nbReleves: derniers.length, medianeMesuree: med };
  }, [coefs, coefSuppose, coefSupposeChoisi]);
}
