import { useMemo, useState } from 'react';
import { formatDate } from '../lib/format.ts';

export type PointCourbe = { date: string; valeur: number };

const L = 52; // marge gauche (libellés de l'axe y)
const R = 8;
const T = 8;
const B = 20;
const W = 480;
const H = 160;

type Props = {
  points: PointCourbe[];
  formatY: (v: number) => string;
  /** Ligne horizontale de référence (objectif). */
  reference?: { valeur: number; label: string };
  /** Borne basse de l'axe (par défaut : min des points − marge). */
  yMin?: number;
  ariaLabel: string;
};

/** Courbe d'une série temporelle : ligne 2 px, marqueurs ≥ 8 px, grille discrète, infobulle au survol. */
export function Courbe({ points, formatY, reference, yMin, ariaLabel }: Props) {
  const [survol, setSurvol] = useState<number | null>(null);
  const geo = useMemo(() => {
    const ts = points.map((p) => new Date(p.date).getTime());
    const vs = points.map((p) => p.valeur);
    const tous = reference ? [...vs, reference.valeur] : vs;
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    const vMin = Math.min(...tous);
    const vMax = Math.max(...tous);
    const marge = Math.max((vMax - vMin) * 0.15, Math.abs(vMax) * 0.05, 1);
    const y0 = yMin ?? vMin - marge;
    const y1 = vMax + marge;
    const x = (t: number) => (t1 === t0 ? L + (W - L - R) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - R));
    const y = (v: number) => T + (1 - (v - y0) / (y1 - y0)) * (H - T - B);
    return { pts: points.map((p, i) => ({ x: x(ts[i]), y: y(vs[i]), p })), grille: [y0, (y0 + y1) / 2, y1], y, t0, t1 };
  }, [points, reference, yMin]);

  const chemin = geo.pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const s = survol !== null ? geo.pts[survol] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-40 w-full text-zinc-500"
      role="img"
      aria-label={ariaLabel}
      onMouseLeave={() => setSurvol(null)}
      onMouseMove={(ev) => {
        const rect = ev.currentTarget.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * W;
        let best = 0;
        for (let i = 1; i < geo.pts.length; i++) if (Math.abs(geo.pts[i].x - x) < Math.abs(geo.pts[best].x - x)) best = i;
        setSurvol(best);
      }}
    >
      {geo.grille.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={geo.y(g)} y2={geo.y(g)} stroke="currentColor" strokeOpacity={0.15} />
          <text x={L - 4} y={geo.y(g) + 3} textAnchor="end" fontSize={10} fill="currentColor">
            {formatY(g)}
          </text>
        </g>
      ))}
      {reference && (
        <g>
          <line x1={L} x2={W - R} y1={geo.y(reference.valeur)} y2={geo.y(reference.valeur)} stroke="#059669" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={W - R} y={geo.y(reference.valeur) - 3} textAnchor="end" fontSize={10} fill="#059669">
            {reference.label}
          </text>
        </g>
      )}
      <text x={L} y={H - 4} fontSize={10} fill="currentColor">
        {formatDate(new Date(geo.t0).toISOString())}
      </text>
      {geo.t1 !== geo.t0 && (
        <text x={W - R} y={H - 4} fontSize={10} textAnchor="end" fill="currentColor">
          {formatDate(new Date(geo.t1).toISOString())}
        </text>
      )}
      {s && <line x1={s.x} x2={s.x} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />}
      <path d={chemin} fill="none" stroke="#0284c7" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {geo.pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={survol === i ? 5 : 4} fill="#0284c7" stroke="#fff" strokeWidth={2} className="dark:[stroke:#18181b]" />
      ))}
      {s && (
        <g transform={`translate(${Math.min(s.x + 8, W - 120)},${Math.max(T, s.y - 30)})`}>
          <rect width={110} height={26} rx={3} fill="#18181b" fillOpacity={0.9} />
          <text x={6} y={11} fontSize={10} fill="#fff">
            {formatDate(s.p.date)}
          </text>
          <text x={6} y={22} fontSize={10} fontWeight="bold" fill="#fff">
            {formatY(s.p.valeur)}
          </text>
        </g>
      )}
    </svg>
  );
}
