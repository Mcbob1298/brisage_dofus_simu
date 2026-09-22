import { useState } from 'react';
import { formatDate, formatPct } from '../lib/format.ts';
import { useNotes } from '../store/notes.ts';
import { ChampNombre } from './ChampNombre.tsx';
import { Courbe } from './Courbe.tsx';

/** Historique des coefficients lus en jeu pour un objet, avec courbe. */
export function JournalCoefficients({ itemId, onAppliquer }: { itemId: number; onAppliquer?: (coef: number) => void }) {
  const entrees = useNotes((s) => s.coefs[itemId]) ?? [];
  const { ajouterCoef, supprimerCoef } = useNotes();
  const [coef, setCoef] = useState<number | null>(null);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const ajouter = () => {
    if (coef === null || !(coef > 0)) return;
    const iso = new Date(`${date}T12:00:00`).toISOString();
    ajouterCoef(itemId, coef, Number.isNaN(Date.parse(iso)) ? undefined : iso);
    setCoef(null);
  };

  const dernier = entrees[entrees.length - 1];
  const precedent = entrees[entrees.length - 2];
  const tendance = dernier && precedent ? dernier.coef - precedent.coef : null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
          Coefficient lu en jeu
          <ChampNombre value={coef} onChange={setCoef} vide suffixe="%" decimales={1} placeholder="ex. 132" className="w-28" />
        </label>
        <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          onClick={ajouter}
          disabled={coef === null}
          className="h-8 rounded bg-zinc-900 px-3 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Noter
        </button>
        {dernier && (
          <span className="tnum ml-auto text-xs text-zinc-500">
            dernier : <strong className="text-zinc-900 dark:text-zinc-100">{formatPct(dernier.coef, 1)}</strong> le {formatDate(dernier.date)}
            {tendance !== null && (
              <span className={tendance > 0 ? 'text-emerald-600 dark:text-emerald-400' : tendance < 0 ? 'text-red-600 dark:text-red-400' : ''}>
                {' '}
                ({tendance > 0 ? '↑' : tendance < 0 ? '↓' : '='} {formatPct(Math.abs(tendance), 1)})
              </span>
            )}
          </span>
        )}
      </div>

      {entrees.length === 0 && <p className="text-xs text-zinc-500">Aucun relevé. Note le coefficient affiché par le concasseur pour suivre sa tendance.</p>}
      {entrees.length >= 2 && (
        <Courbe points={entrees.map((e) => ({ date: e.date, valeur: e.coef }))} formatY={(v) => `${Math.round(v)} %`} yMin={0} ariaLabel="Évolution du coefficient" />
      )}

      {entrees.length > 0 && (
        <ul className="max-h-40 divide-y divide-zinc-100 overflow-y-auto text-xs dark:divide-zinc-800">
          {[...entrees].reverse().map((e, iInv) => {
            const i = entrees.length - 1 - iInv;
            return (
              <li key={`${e.date}-${i}`} className="flex items-center gap-2 py-0.5">
                <span className="tnum w-20 text-zinc-500">{formatDate(e.date)}</span>
                <span className="tnum font-medium">{formatPct(e.coef, 1)}</span>
                {onAppliquer && (
                  <button onClick={() => onAppliquer(e.coef)} className="text-sky-600 hover:underline dark:text-sky-400">
                    utiliser
                  </button>
                )}
                <button onClick={() => supprimerCoef(itemId, i)} className="ml-auto text-zinc-400 hover:text-red-600" aria-label="Supprimer ce relevé">
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
