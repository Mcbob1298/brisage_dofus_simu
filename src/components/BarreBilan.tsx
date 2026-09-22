import { formatKamas, formatPct } from '../lib/format.ts';
import type { Simulation } from '../hooks/useSimulation.ts';
import { STAT_BY_ID } from '../data/statMapping.ts';

function Kpi({ label, valeur, ton = 'neutre', detail }: { label: string; valeur: string; ton?: 'neutre' | 'ok' | 'ko' | 'alerte'; detail?: string }) {
  const couleur = {
    neutre: '',
    ok: 'text-ok',
    ko: 'text-ko',
    alerte: 'text-alerte',
  }[ton];
  return (
    <div className="min-w-0">
      <div className="truncate titre-section">{label}</div>
      <div className={`tnum truncate text-lg leading-tight font-semibold ${couleur}`} title={detail}>
        {valeur}
      </div>
      {detail && <div className="truncate text-[11px] text-encre-2">{detail}</div>}
    </div>
  );
}

/** Bénéfice net et coefficient seuil, toujours visibles sous l'en-tête. */
export function BarreBilan({ sim }: { sim: Simulation | null }) {
  if (!sim) return null;
  const { bilan, seuil, entree, resultat } = sim;
  const v = bilan[bilan.retenu];
  const prixManquants = resultat.prixManquants.length;
  const sansPrix = prixManquants > 0 && v.valeurBrute === 0;
  const tonBenef = sansPrix ? 'alerte' : v.benefice > 0 ? 'ok' : v.benefice < 0 ? 'ko' : 'neutre';
  const rentableAuCoef = seuil !== null && entree.coefficient >= seuil;

  return (
    <div className="sticky top-0 z-10 border-b border-bord bg-surface/85 shadow-carte backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-4 gap-y-1 px-3 py-1.5 sm:grid-cols-4">
        <Kpi
          label={`Bénéfice net${bilan.nbObjets > 1 ? ` (lot de ${bilan.nbObjets}, espérance)` : ''}`}
          valeur={sansPrix ? 'prix manquants' : formatKamas(v.benefice)}
          ton={tonBenef}
          detail={v.roi !== null && !sansPrix ? `ROI ${formatPct(v.roi)}` : sansPrix ? `${prixManquants} rune(s) sans prix` : 'sans prix de revient'}
        />
        <Kpi
          label="Coefficient seuil"
          valeur={sansPrix ? '—' : seuil === null ? 'jamais rentable' : seuil <= 1 ? '≤ 1 %' : formatPct(seuil, 1)}
          ton={sansPrix ? 'neutre' : seuil === null ? 'ko' : rentableAuCoef ? 'ok' : 'ko'}
          detail={seuil === null || sansPrix ? undefined : `saisi : ${formatPct(entree.coefficient, 1)} — ${rentableAuCoef ? 'rentable' : 'à perte'}`}
        />
        <Kpi label="Valeur nette des runes" valeur={formatKamas(v.valeurNette)} detail={`brut ${formatKamas(v.valeurBrute)}, taxe ${formatKamas(v.taxe)}`} />
        <Kpi
          label="Stratégie"
          valeur={entree.focus ? `Focus ${STAT_BY_ID[entree.focus].label}` : 'Naturel'}
          detail={entree.focus ? 'les autres lignes ne rendent rien' : 'toutes les lignes'}
        />
      </div>
    </div>
  );
}
