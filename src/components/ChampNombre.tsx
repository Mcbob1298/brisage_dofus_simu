import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { formatNombre, parseNombre } from '../lib/format.ts';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null;
  onChange: (v: number | null) => void;
  /** Décimales conservées à l'affichage. */
  decimales?: number;
  /** Autoriser la valeur vide (null). */
  vide?: boolean;
  suffixe?: string;
};

/**
 * Saisie numérique : affichage formaté à la française (milliers espacés),
 * édition libre (accepte « 12,5k »), validation au blur ou à Entrée.
 */
export function ChampNombre({ value, onChange, decimales = 0, vide = false, suffixe, className = '', ...rest }: Props) {
  const affiche = (v: number | null) => (v === null || Number.isNaN(v) ? '' : formatNombre(v, decimales));
  const [texte, setTexte] = useState(affiche(value));
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    if (!focus) setTexte(affiche(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focus]);

  const valider = () => {
    const n = parseNombre(texte);
    if (Number.isNaN(n)) {
      if (vide) onChange(null);
      setTexte(affiche(vide ? null : value));
    } else {
      const arrondi = Number(n.toFixed(decimales));
      onChange(arrondi);
      setTexte(affiche(arrondi));
    }
  };

  return (
    <span className={`relative inline-flex items-center ${className}`}>
      <input
        {...rest}
        type="text"
        inputMode="decimal"
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        onFocus={(e) => {
          setFocus(true);
          e.target.select();
        }}
        onBlur={() => {
          setFocus(false);
          valider();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        className={`tnum h-8 w-full rounded border border-zinc-300 bg-white px-2 text-right text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-zinc-700 dark:bg-zinc-900 ${suffixe ? 'pr-7' : ''}`}
      />
      {suffixe && (
        <span className="pointer-events-none absolute right-2 text-xs text-zinc-500">{suffixe}</span>
      )}
    </span>
  );
}
