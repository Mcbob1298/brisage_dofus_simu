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

  if (!sim) return <p className="text-sm text-encre-2">Choisis d'abord un objet dans l'onglet Objet.</p>;
  if (comparaisons.length === 0) return <p className="text-sm text-encre-2">Aucune ligne brisable sur cet objet.</p>;

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
          <p className="text-xs text-encre-2">
            niveau {item.niveau} · coef. {formatPct(sim.entree.coefficient, 1)} · {sim.options.nbObjets > 1 ? `lot de ${sim.options.nbObjets} (espérance)` : 'garanti'}
          </p>
        </div>
      </div>

      <p className="rounded border border-ok/40 bg-ok-doux px-3 py-2 text-sm">
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

      <div className="carte overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-encre-2">
            <tr className="border-b border-bord">
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
                  className={`border-t border-bord ${i === 0 ? 'bg-ok-doux/60' : ''} ${actif ? 'font-medium' : ''}`}
                >
                  <td className="px-2 py-1">
                    {i === 0 && <span className="mr-1 text-ok">★</span>}
                    {c.focus === null ? 'Naturel (toutes les lignes)' : `Focus ${STAT_BY_ID[c.focus].label}`}
                    {actif && <span className="ml-1 text-xs text-encre-2">(sélectionné)</span>}
                  </td>
                  <td className="tnum px-2 py-1 text-right">{formatKamas(v.valeurNette)}</td>
                  <td className={`tnum px-2 py-1 text-right ${v.benefice > 0 ? 'text-ok' : v.benefice < 0 ? 'text-ko' : ''}`}>
                    {formatKamas(v.benefice)}
                  </td>
                  <td className="tnum px-2 py-1 text-right text-encre-2">{c.focus === null ? '—' : `${delta >= 0 ? '+' : ''}${formatKamas(delta)}`}</td>
                  <td className="tnum px-2 py-1 text-right">{c.seuil === null ? 'jamais' : c.seuil <= 1 ? '≤ 1 %' : formatPct(c.seuil, 1)}</td>
                  <td className="tnum px-2 py-1 text-right text-encre-2">{nbRunes}</td>
                  <td className="px-2 py-1 text-right">
                    {!actif && (
                      <button onClick={() => setFocus(c.focus)} className="text-xs lien">
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
      <p className="text-xs text-encre-2">
        Le focus détruit les autres lignes et n'en reverse que 50 % du poids sur la rune ciblée. Le seuil est le coefficient minimal pour que la stratégie soit rentable.
      </p>
    </div>
  );
}
