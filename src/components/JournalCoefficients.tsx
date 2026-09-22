import { useMemo, useState } from 'react';
import { formatDate, formatPct } from '../lib/format.ts';
import { useNotes, type EntreeCoef } from '../store/notes.ts';
import { ChampNombre } from './ChampNombre.tsx';

const L = 36; // marge gauche (axe y)
const R = 8;
const T = 8;
const B = 20;
const W = 480;
const H = 160;

/** Courbe du coefficient dans le temps — une série, ligne 2 px, marqueurs 8 px, survol. */
function Courbe({ entrees }: { entrees: EntreeCoef[] }) {
  const [survol, setSurvol] = useState<number | null>(null);
  const pts = useMemo(() => {
    const ts = entrees.map((e) => new Date(e.date).getTime());
    const cs = entrees.map((e) => e.coef);
    const t0 = Math.min(...ts);
    const t1 = Math.max(...ts);
    const cMin = Math.min(...cs);
    const cMax = Math.max(...cs);
    const marge = Math.max(5, (cMax - cMin) * 0.15);
    const y0 = Math.max(0, Math.floor((cMin - marge) / 10) * 10);
    const y1 = Math.ceil((cMax + marge) / 10) * 10;
    const x = (t: number) => (t1 === t0 ? L + (W - L - R) / 2 : L + ((t - t0) / (t1 - t0)) * (W - L - R));
    const y = (c: number) => T + (1 - (c - y0) / (y1 - y0)) * (H - T - B);
    const grille = [y0, (y0 + y1) / 2, y1];
    return { points: entrees.map((e, i) => ({ x: x(ts[i]), y: y(cs[i]), e })), grille, y, t0, t1 };
  }, [entrees]);

  const chemin = pts.points.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const s = survol !== null ? pts.points[survol] : null;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-40 w-full text-zinc-500"
      role="img"
      aria-label="Évolution du coefficient"
      onMouseLeave={() => setSurvol(null)}
      onMouseMove={(ev) => {
        const rect = ev.currentTarget.getBoundingClientRect();
        const x = ((ev.clientX - rect.left) / rect.width) * W;
        let best = 0;
        for (let i = 1; i < pts.points.length; i++) if (Math.abs(pts.points[i].x - x) < Math.abs(pts.points[best].x - x)) best = i;
        setSurvol(best);
      }}
    >
      {pts.grille.map((g) => (
        <g key={g}>
          <line x1={L} x2={W - R} y1={pts.y(g)} y2={pts.y(g)} stroke="currentColor" strokeOpacity={0.15} />
          <text x={L - 4} y={pts.y(g) + 3} textAnchor="end" fontSize={10} fill="currentColor">
            {Math.round(g)} %
          </text>
        </g>
      ))}
      <text x={L} y={H - 4} fontSize={10} fill="currentColor">
        {formatDate(new Date(pts.t0).toISOString())}
      </text>
      {pts.t1 !== pts.t0 && (
        <text x={W - R} y={H - 4} fontSize={10} textAnchor="end" fill="currentColor">
          {formatDate(new Date(pts.t1).toISOString())}
        </text>
      )}
      {s && <line x1={s.x} x2={s.x} y1={T} y2={H - B} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="3 3" />}
      <path d={chemin} fill="none" stroke="#0284c7" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={survol === i ? 5 : 4} fill="#0284c7" stroke="var(--color-white, #fff)" strokeWidth={2} className="dark:[stroke:#18181b]" />
      ))}
      {s && (
        <g transform={`translate(${Math.min(s.x + 8, W - 110)},${Math.max(T, s.y - 30)})`}>
          <rect width={100} height={26} rx={3} fill="#18181b" fillOpacity={0.9} />
          <text x={6} y={11} fontSize={10} fill="#fff">
            {formatDate(s.e.date)}
          </text>
          <text x={6} y={22} fontSize={10} fontWeight="bold" fill="#fff">
            {formatPct(s.e.coef, 1)}
          </text>
        </g>
      )}
    </svg>
  );
}

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
      {entrees.length >= 2 && <Courbe entrees={entrees} />}

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
