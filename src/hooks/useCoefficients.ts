import { useMemo } from 'react';
import { dernierCoef, useNotes, type EntreeCoef } from '../store/notes.ts';
import { useReglages } from '../store/reglages.ts';

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

export type CoefObjet = {
  /** Coefficient retenu pour cet objet : le relevé s'il existe, sinon l'hypothèse globale. */
  coef: number;
  /** Dernier relevé au concasseur pour cet objet, `null` si jamais testé. */
  releve: EntreeCoef | null;
  /** Note un relevé pour cet objet (sans objet sélectionné, ne fait rien). */
  setCoef: (coef: number) => void;
};

/**
 * Le coefficient d'un objet est une donnée DE l'objet, pas un réglage de la
 * simulation : il vit dans le journal des relevés, qui alimente aussi les
 * recommandations, le farm et la recherche inverse. Saisir une valeur ici, c'est
 * donc noter un relevé — et changer d'objet change de coefficient.
 */
export function useCoefObjet(itemId: number | null): CoefObjet {
  const coefs = useNotes((s) => s.coefs);
  const ajouterCoef = useNotes((s) => s.ajouterCoef);
  const coefSuppose = useReglages((s) => s.coefSuppose);
  return useMemo(() => {
    const releve = itemId !== null ? dernierCoef(coefs[itemId]) : null;
    const courant = releve?.coef ?? coefSuppose;
    return {
      coef: courant,
      releve,
      setCoef: (coef) => {
        if (itemId === null) return;
        // Deux relevés le même jour sont légitimes (le coefficient baisse à
        // mesure qu'on brise), mais reposer la valeur déjà affichée n'en est
        // pas un : traverser le champ sans rien changer ne doit ni empiler de
        // doublon, ni transformer l'hypothèse globale en relevé.
        if (coef === courant) return;
        ajouterCoef(itemId, coef);
      },
    };
  }, [itemId, coefs, coefSuppose, ajouterCoef]);
}
