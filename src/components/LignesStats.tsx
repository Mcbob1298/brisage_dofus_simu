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
    return <p className="text-sm text-encre-2">Cet objet n'a aucune caractéristique : rien à briser.</p>;
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Jet global" className="segment">
          {MODES.map((m) => (
            <button
              key={m.id}
              role="radio"
              aria-checked={jetMode === m.id}
              onClick={() => setJetMode(m.id)}
              className={`px-2.5 py-1 text-xs first:rounded-l last:rounded-r ${
                jetMode === m.id
                  ? 'bg-accent text-white'
                  : 'text-encre-2 hover:bg-surface-2'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
        {modifiees && (
          <button onClick={resetLignes} className="text-xs lien">
            ↺ Remettre les valeurs de base
          </button>
        )}
        {focus !== null && (
          <button onClick={() => setFocus(null)} className="ml-auto text-xs lien">
            Sans focus
          </button>
        )}
      </div>

      <table className="w-full text-sm">
        <thead className="text-left text-xs text-encre-2">
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
            // Jet nul ≠ malus : la ligne pèse son plancher et rend des runes.
            const malus = l.max < 0;
            const estFocus = focus === l.statId;
            return (
              <tr
                key={`${l.statId}-${i}`}
                className={`border-t border-bord ${malus ? 'text-encre-3' : ''} ${
                  estFocus ? 'bg-accent-doux' : ''
                }`}
              >
                <td className="py-1">
                  <input
                    type="checkbox"
                    checked={estFocus}
                    disabled={malus}
                    onChange={(e) => setFocus(e.target.checked ? l.statId : null)}
                    aria-label={`Focus ${STAT_BY_ID[l.statId].label}`}
                    className="accent-accent"
                  />
                </td>
                <td className="py-1">
                  {STAT_BY_ID[l.statId].label}
                  {malus && <span className="ml-1 text-xs">(malus, ne rend rien)</span>}
                </td>
                <td className="tnum py-1 text-right text-xs whitespace-nowrap text-encre-2">
                  {l.min === l.max ? formatNombre(l.min) : `${formatNombre(l.min)} à ${formatNombre(l.max)}`}
                </td>
                <td className="py-1 pl-2">
                  <ChampNombre
                    value={l.jet}
                    onChange={(v) => setJet(i, v ?? 0)}
                    aria-label={`Jet ${STAT_BY_ID[l.statId].label}`}
                    className={`w-full ${l.modifie ? '[&>input]:border-accent' : ''}`}
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
