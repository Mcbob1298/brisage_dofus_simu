import { useState } from 'react';
import { STAT_BY_ID } from '../data/statMapping.ts';
import type { Simulation } from '../hooks/useSimulation.ts';
import { formatKamas, formatNombre, formatPct } from '../lib/format.ts';
import { RuneImage } from './RuneImage.tsx';

/** Runes obtenues, ligne par ligne, avec le reste exprimé en probabilité. */
export function Butin({ sim, onVoirPrix }: { sim: Simulation; onVoirPrix: () => void }) {
  const { resultat, ctx } = sim;
  if (resultat.parStat.length === 0) {
    return <p className="text-sm text-zinc-500">Aucune ligne ne produit de rune (jets nuls ou malus).</p>;
  }
  return (
    <div className="space-y-2">
      {resultat.prixManquants.length > 0 && (
        <p className="rounded border border-orange-200 bg-orange-50 px-2 py-1 text-xs text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
          {resultat.prixManquants.length} rune(s) sans prix, comptées à 0 :{' '}
          {resultat.prixManquants.map((r) => r.nom).join(', ')}.{' '}
          <button onClick={onVoirPrix} className="underline">
            Renseigner
          </button>
        </p>
      )}
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-zinc-500">
          <tr>
            <th className="pb-1 font-medium" colSpan={2}>
              Rune
            </th>
            <th className="pb-1 text-right font-medium">Qté</th>
            <th className="pb-1 text-right font-medium">Prix unit.</th>
            <th className="pb-1 text-right font-medium">Valeur</th>
          </tr>
        </thead>
        {resultat.parStat.map((rs) => (
          <tbody key={rs.statId} className="border-t border-zinc-100 dark:border-zinc-800">
            <tr>
              <td colSpan={2} className="pt-2 pb-0.5 text-xs font-medium text-zinc-500">
                {STAT_BY_ID[rs.statId].label}
                <span className="tnum ml-1 font-normal">· {formatNombre(rs.points, 2)} pts</span>
              </td>
              <td colSpan={3} className="tnum pt-2 pb-0.5 text-right text-xs text-zinc-500">
                {formatKamas(rs.valeurGarantie)}
                {rs.reste > 0 && rs.runeReste && ` (esp. ${formatKamas(rs.valeurEsperee)})`}
              </td>
            </tr>
            {rs.runes.map((r) => (
              <tr key={r.rune.id}>
                <td className="w-8 py-0.5">
                  <RuneImage rune={r.rune} taille={24} />
                </td>
                <td className="py-0.5">{r.rune.nom}</td>
                <td className="tnum py-0.5 text-right">× {formatNombre(r.quantite)}</td>
                <td className="tnum py-0.5 text-right text-zinc-500">
                  {r.prixUnitaire === undefined ? <span className="text-orange-600 dark:text-orange-400">?</span> : formatKamas(r.prixUnitaire)}
                </td>
                <td className="tnum py-0.5 text-right">{formatKamas(r.quantite * (r.prixUnitaire ?? 0))}</td>
              </tr>
            ))}
            {rs.reste > 0 && rs.runeReste && (
              <tr className="text-xs text-zinc-500">
                <td className="py-0.5">
                  <RuneImage rune={rs.runeReste} taille={24} className="opacity-50" />
                </td>
                <td className="py-0.5" colSpan={2}>
                  <span className="tnum">{formatPct(rs.reste * 100)}</span> de chance d'une {rs.runeReste.nom.replace(/^Rune /, '')} supplémentaire
                </td>
                <td className="tnum py-0.5 text-right">
                  {ctx.prix[rs.runeReste.id] === undefined ? '?' : formatKamas(ctx.prix[rs.runeReste.id]!)}
                </td>
                <td className="tnum py-0.5 text-right">≈ {formatKamas(rs.reste * (ctx.prix[rs.runeReste.id] ?? 0))}</td>
              </tr>
            )}
            {rs.runes.length === 0 && rs.reste === 0 && (
              <tr className="text-xs text-zinc-400">
                <td colSpan={5}>aucune rune pour cette caractéristique</td>
              </tr>
            )}
          </tbody>
        ))}
      </table>
    </div>
  );
}

function Ligne({ label, valeur, fort, ton }: { label: string; valeur: string; fort?: boolean; ton?: 'ok' | 'ko' }) {
  const couleur = ton === 'ok' ? 'text-emerald-600 dark:text-emerald-400' : ton === 'ko' ? 'text-red-600 dark:text-red-400' : '';
  return (
    <div className={`flex justify-between gap-2 ${fort ? 'border-t border-zinc-200 pt-1 font-semibold dark:border-zinc-700' : ''}`}>
      <span className={fort ? '' : 'text-zinc-500'}>{label}</span>
      <span className={`tnum ${couleur}`}>{valeur}</span>
    </div>
  );
}

/** Bilan chiffré, avec bascule garanti / espérance. */
export function BilanDetaille({ sim }: { sim: Simulation }) {
  const { bilan, seuil, entree } = sim;
  const [vue, setVue] = useState<'garanti' | 'espere' | null>(null);
  const cle = vue ?? bilan.retenu;
  const v = bilan[cle];
  return (
    <div className="space-y-1 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <div role="radiogroup" className="inline-flex rounded border border-zinc-300 text-xs dark:border-zinc-700">
          {(['garanti', 'espere'] as const).map((k) => (
            <button
              key={k}
              role="radio"
              aria-checked={cle === k}
              onClick={() => setVue(k)}
              className={`px-2 py-0.5 first:rounded-l last:rounded-r ${cle === k ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'text-zinc-600 dark:text-zinc-400'}`}
              title={k === 'garanti' ? 'Runes entières uniquement' : 'Runes entières + probabilité des restes'}
            >
              {k === 'garanti' ? 'Garanti' : 'Espérance'}
            </button>
          ))}
        </div>
        {bilan.nbObjets > 1 && <span className="tnum text-xs text-zinc-500">lot de {bilan.nbObjets}</span>}
      </div>
      <Ligne label="Valeur brute des runes" valeur={formatKamas(v.valeurBrute)} />
      <Ligne label={`Taxe de vente (${formatPct(sim.options.taxePct, 1)})`} valeur={`− ${formatKamas(v.taxe)}`} />
      <Ligne label="Valeur nette" valeur={formatKamas(v.valeurNette)} />
      <Ligne label={`Prix de revient${bilan.nbObjets > 1 ? ` × ${bilan.nbObjets}` : ''}`} valeur={`− ${formatKamas(bilan.coutTotal)}`} />
      <Ligne label="Bénéfice net" valeur={formatKamas(v.benefice)} fort ton={v.benefice > 0 ? 'ok' : v.benefice < 0 ? 'ko' : undefined} />
      <Ligne label="ROI" valeur={v.roi === null ? '— (pas de prix de revient)' : formatPct(v.roi)} />
      <Ligne
        label="Coefficient seuil"
        valeur={seuil === null ? 'jamais rentable (≤ 4000 %)' : seuil <= 1 ? '≤ 1 %' : formatPct(seuil, 1)}
        ton={seuil !== null && entree.coefficient >= seuil ? 'ok' : 'ko'}
      />
      <p className="pt-1 text-xs text-zinc-500">
        Le seuil est calculé sur l'espérance : en dessous, on brise à perte avec ces prix. Compare-le au coefficient affiché par le concasseur.
      </p>
    </div>
  );
}
