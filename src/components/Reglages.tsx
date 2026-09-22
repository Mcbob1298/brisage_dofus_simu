import { useState } from 'react';
import { STATS } from '../data/statMapping.ts';
import { POIDS_DEFAUT } from '../engine/poids.ts';
import type { ModeRepartition } from '../engine/types.ts';
import { useReglages } from '../store/reglages.ts';
import { ChampNombre } from './ChampNombre.tsx';

const MODES: { id: ModeRepartition; label: string; aide: string }[] = [
  { id: 'greedy', label: 'Ra, puis Pa, puis simples', aide: 'Hypothèse la plus proche du comportement observé en jeu (par défaut).' },
  { id: 'valeurMax', label: 'Valeur max (sac-à-dos)', aide: 'Répartition qui maximise les kamas selon tes prix : borne haute théorique.' },
  { id: 'toutSimple', label: 'Tout en runes simples', aide: 'Borne basse : aucune Pa ni Ra.' },
];

/** Mode de répartition et table des poids éditable. */
export function Reglages() {
  const { poids, mode, setPoids, resetPoids, setMode } = useReglages();
  const [ouvert, setOuvert] = useState(false);
  const modifies = STATS.filter((s) => poids[s.id] !== POIDS_DEFAUT[s.id]).length;

  return (
    <div className="space-y-3">
      <fieldset>
        <legend className="mb-1 titre-section">Répartition des runes</legend>
        <div className="space-y-1">
          {MODES.map((m) => (
            <label key={m.id} className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="radio" name="mode" checked={mode === m.id} onChange={() => setMode(m.id)} className="mt-1 accent-accent" />
              <span>
                {m.label}
                <span className="block text-xs text-encre-2">{m.aide}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1 text-xs text-encre-2">
          La répartition exacte Ra / Pa / simples n'est documentée nulle part publiquement : ces trois modes sont des hypothèses.
        </p>
      </fieldset>

      <div>
        <button
          onClick={() => setOuvert((o) => !o)}
          className="flex w-full items-center justify-between titre-section hover:text-encre"
          aria-expanded={ouvert}
        >
          <span>
            Poids des caractéristiques {modifies > 0 && <span className="normal-case text-lien">· {modifies} modifié(s)</span>}
          </span>
          <span>{ouvert ? '▾' : '▸'}</span>
        </button>
        {ouvert && (
          <div className="mt-2">
            <p className="mb-2 text-xs text-encre-2">
              Valeurs de départ : tables communautaires 2026 (dafous.app). Désaccords connus : Vitalité 0,25 ou 0,2 ; Ré Critiques / Ré Poussée 2 ou 5.
              Le poids ne joue que sur le transfert du focus.
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3">
              {STATS.map((s) => (
                <label key={s.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className={`truncate ${poids[s.id] !== POIDS_DEFAUT[s.id] ? 'text-lien' : 'text-encre-2'}`} title={s.label}>
                    {s.label}
                  </span>
                  <ChampNombre
                    value={poids[s.id]}
                    onChange={(v) => setPoids(s.id, v !== null && v > 0 ? v : POIDS_DEFAUT[s.id])}
                    decimales={2}
                    className="w-16 [&>input]:h-7"
                    aria-label={`Poids ${s.label}`}
                  />
                </label>
              ))}
            </div>
            <button onClick={resetPoids} disabled={modifies === 0} className="lien mt-2 text-xs disabled:text-encre-3 disabled:no-underline">
              ↺ Remettre les poids par défaut
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
