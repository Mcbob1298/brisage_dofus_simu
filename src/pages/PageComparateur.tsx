import { STAT_BY_ID } from '../data/statMapping.ts';
import { placeholderPour } from '../data/statMapping.ts';
import { ItemImage } from '../components/ItemImage.tsx';
import { useComparaisonFocus, type Simulation } from '../hooks/useSimulation.ts';
import { formatKamas, formatPct } from '../lib/format.ts';
import { useSimu } from '../store/simu.ts';

/** Brisage naturel vs focus sur chaque ligne, classés par bénéfice net. */
export function PageComparateur({ sim }: { sim: Simulation | null }) {
  const comparaisons = useComparaisonFocus(sim);
  const setFocus = useSimu((s) => s.setFocus);

  if (!sim) return <p className="text-sm text-zinc-500">Choisis d'abord un objet dans l'onglet Objet.</p>;
  if (comparaisons.length === 0) return <p className="text-sm text-zinc-500">Aucune ligne brisable sur cet objet.</p>;

  const cle = sim.bilan.retenu;
  const naturel = comparaisons.find((c) => c.focus === null)!;
  const gagnant = comparaisons[0];
  const { item } = sim;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={40} />
        <div>
          <h2 className="font-semibold">{item.nom}</h2>
          <p className="text-xs text-zinc-500">
            niveau {item.niveau} · coef. {formatPct(sim.entree.coefficient, 1)} · {sim.options.nbObjets > 1 ? `lot de ${sim.options.nbObjets} (espérance)` : 'garanti'}
          </p>
        </div>
      </div>

      <p className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm dark:border-emerald-900 dark:bg-emerald-950">
        <strong>Gagnant : {gagnant.focus === null ? 'brisage naturel' : `focus ${STAT_BY_ID[gagnant.focus].label}`}</strong>
        {' — '}
        bénéfice <span className="tnum">{formatKamas(gagnant.bilan[cle].benefice)}</span>
        {gagnant.focus !== null && (
          <>
            , soit <span className="tnum">{formatKamas(gagnant.bilan[cle].benefice - naturel.bilan[cle].benefice)}</span> de plus que le naturel
          </>
        )}
        .
      </p>

      <div className="overflow-x-auto rounded border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-zinc-500">
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="px-2 py-1.5 font-medium">Stratégie</th>
              <th className="px-2 py-1.5 text-right font-medium">Valeur nette</th>
              <th className="px-2 py-1.5 text-right font-medium">Bénéfice</th>
              <th className="px-2 py-1.5 text-right font-medium">Δ vs naturel</th>
              <th className="px-2 py-1.5 text-right font-medium">Seuil</th>
              <th className="px-2 py-1.5 text-right font-medium">Runes</th>
              <th className="px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {comparaisons.map((c, i) => {
              const v = c.bilan[cle];
              const delta = v.benefice - naturel.bilan[cle].benefice;
              const actif = sim.entree.focus === c.focus;
              const nbRunes = c.resultat.parStat.reduce((s, rs) => s + rs.runes.reduce((t, r) => t + r.quantite, 0), 0);
              return (
                <tr
                  key={c.focus ?? 'naturel'}
                  className={`border-t border-zinc-100 dark:border-zinc-800 ${i === 0 ? 'bg-emerald-50/60 dark:bg-emerald-950/40' : ''} ${actif ? 'font-medium' : ''}`}
                >
                  <td className="px-2 py-1">
                    {i === 0 && <span className="mr-1 text-emerald-600 dark:text-emerald-400">★</span>}
                    {c.focus === null ? 'Naturel (toutes les lignes)' : `Focus ${STAT_BY_ID[c.focus].label}`}
                    {actif && <span className="ml-1 text-xs text-zinc-500">(sélectionné)</span>}
                  </td>
                  <td className="tnum px-2 py-1 text-right">{formatKamas(v.valeurNette)}</td>
                  <td className={`tnum px-2 py-1 text-right ${v.benefice > 0 ? 'text-emerald-600 dark:text-emerald-400' : v.benefice < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                    {formatKamas(v.benefice)}
                  </td>
                  <td className="tnum px-2 py-1 text-right text-zinc-500">{c.focus === null ? '—' : `${delta >= 0 ? '+' : ''}${formatKamas(delta)}`}</td>
                  <td className="tnum px-2 py-1 text-right">{c.seuil === null ? 'jamais' : c.seuil <= 1 ? '≤ 1 %' : formatPct(c.seuil, 1)}</td>
                  <td className="tnum px-2 py-1 text-right text-zinc-500">{nbRunes}</td>
                  <td className="px-2 py-1 text-right">
                    {!actif && (
                      <button onClick={() => setFocus(c.focus)} className="text-xs text-sky-600 hover:underline dark:text-sky-400">
                        appliquer
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Le focus détruit les autres lignes et n'en reverse que 50 % du poids sur la rune ciblée. Le seuil est le coefficient minimal pour que la stratégie soit rentable.
      </p>
    </div>
  );
}
