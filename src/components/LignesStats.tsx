import { STAT_BY_ID } from '../data/statMapping.ts';
import { useSimu, type JetMode } from '../store/simu.ts';
import { ChampNombre } from './ChampNombre.tsx';
import { formatNombre } from '../lib/format.ts';

const MODES: { id: JetMode; label: string }[] = [
  { id: 'min', label: 'Jet min' },
  { id: 'moyen', label: 'Moyen' },
  { id: 'max', label: 'Jet max' },
];

/** Lignes de caractéristiques de l'objet : jet global min/moyen/max, édition par ligne, focus. */
export function LignesStats() {
  const { lignes, jetMode, focus, setJetMode, setJet, resetLignes, setFocus } = useSimu();
  const modifiees = lignes.some((l) => l.modifie);

  if (lignes.length === 0) {
    return <p className="text-sm text-zinc-500">Cet objet n'a aucune caractéristique : rien à briser.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Jet global" className="inline-flex rounded border border-zinc-300 dark:border-zinc-700">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={jetMode === m.id}
              onClick={() => setJetMode(m.id)}
              className={`px-2.5 py-1 text-xs first:rounded-l last:rounded-r ${
                jetMode === m.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {modifiees && (
          <button onClick={resetLignes} className="text-xs text-sky-600 hover:underline dark:text-sky-400">
            ↺ Remettre les valeurs de base
          </button>
        )}
        {focus !== null && (
          <button onClick={() => setFocus(null)} className="ml-auto text-xs text-sky-600 hover:underline dark:text-sky-400">
            Sans focus
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="w-12 pb-1 pr-2 font-medium" title="Focus sur cette ligne">
              Focus
            </th>
            <th className="pb-1 font-medium">Caractéristique</th>
            <th className="pb-1 text-right font-medium">Fourchette</th>
            <th className="w-24 pb-1 text-right font-medium">Jet</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((l, i) => {
            const malus = l.max <= 0;
            const estFocus = focus === l.statId;
            return (
              <tr
                key={`${l.statId}-${i}`}
                className={`border-t border-zinc-100 dark:border-zinc-800 ${malus ? 'text-zinc-400 dark:text-zinc-600' : ''} ${
                  estFocus ? 'bg-amber-50 dark:bg-amber-900/20' : ''
                }`}
              >
                <td className="py-1">
                  <input
                    type="checkbox"
                    checked={estFocus}
                    disabled={malus}
                    onChange={(e) => setFocus(e.target.checked ? l.statId : null)}
                    aria-label={`Focus ${STAT_BY_ID[l.statId].label}`}
                    className="accent-amber-500"
                  />
                </td>
                <td className="py-1">
                  {STAT_BY_ID[l.statId].label}
                  {malus && <span className="ml-1 text-xs">(malus, ne rend rien)</span>}
                </td>
                <td className="tnum py-1 text-right text-xs whitespace-nowrap text-zinc-500">
                  {l.min === l.max ? formatNombre(l.min) : `${formatNombre(l.min)} à ${formatNombre(l.max)}`}
                </td>
                <td className="py-1 pl-2">
                  <ChampNombre
                    value={l.jet}
                    onChange={(v) => setJet(i, v ?? 0)}
                    aria-label={`Jet ${STAT_BY_ID[l.statId].label}`}
                    className={`w-full ${l.modifie ? '[&>input]:border-sky-400' : ''}`}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
