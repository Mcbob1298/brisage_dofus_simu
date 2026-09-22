import { useMemo, useRef, useState } from 'react';
import { ALL_STAT_IDS, STAT_BY_ID, type StatId } from '../data/statMapping.ts';
import type { RuneDef, RuneTier } from '../data/types.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import { RuneImage } from '../components/RuneImage.tsx';
import { formatDate, joursDepuis } from '../lib/format.ts';
import { normaliser } from '../lib/normaliser.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { JOURS_PERIME, useStorePrix } from '../store/prix.ts';
import { useSimu } from '../store/simu.ts';

const TIER_LABEL: Record<RuneTier, string> = { simple: '', pa: 'Pa', ra: 'Ra' };

function LigneRune({ rune }: { rune: RuneDef }) {
  const enregistre = useStorePrix((s) => s.prix[rune.id]);
  const setPrix = useStorePrix((s) => s.setPrix);
  const jours = enregistre ? joursDepuis(enregistre.date) : null;
  const perime = jours !== null && jours > JOURS_PERIME;
  return (
    <tr className="border-t border-bord">
      <td className="w-9 py-1 pr-2">
        <RuneImage rune={rune} taille={28} />
      </td>
      <td className="py-1 text-sm">
        {rune.nom}
        {rune.tier !== 'simple' && (
          <span className="ml-1.5 rounded bg-surface-2 px-1 text-[10px] font-medium text-encre-2">
            {TIER_LABEL[rune.tier]} · {rune.valeur} pts
          </span>
        )}
      </td>
      <td className="w-32 py-1 pl-2">
        <ChampNombre
          value={enregistre?.prix ?? null}
          onChange={(v) => setPrix(rune.id, v)}
          vide
          placeholder="—"
          aria-label={`Prix ${rune.nom}`}
          className="w-full"
        />
      </td>
      <td className="tnum w-28 py-1 pl-2 text-right text-xs whitespace-nowrap">
        {enregistre ? (
          <span
            className={perime ? 'rounded bg-alerte-doux px-1 text-alerte' : 'text-encre-2'}
            title={perime ? `Prix vieux de ${jours} jours` : 'Dernière mise à jour'}
          >
            {formatDate(enregistre.date)}
            {perime && ' ⚠'}
          </span>
        ) : (
          <span className="text-encre-3">non renseigné</span>
        )}
      </td>
    </tr>
  );
}

function GroupeStat({ statId, runes }: { statId: StatId; runes: RuneDef[] }) {
  return (
    <tbody>
      <tr>
        <th colSpan={4} className="px-1 pt-3 pb-1 text-left titre-section">
          {STAT_BY_ID[statId].label}
        </th>
      </tr>
      {runes.map((r) => (
        <LigneRune key={r.id} rune={r} />
      ))}
    </tbody>
  );
}

function grouperParStat(runes: RuneDef[]): [StatId, RuneDef[]][] {
  const ordre: Record<RuneTier, number> = { simple: 0, pa: 1, ra: 2 };
  const m = new Map<StatId, RuneDef[]>();
  for (const r of runes) {
    if (!m.has(r.statId)) m.set(r.statId, []);
    m.get(r.statId)!.push(r);
  }
  for (const l of m.values()) l.sort((a, b) => ordre[a.tier] - ordre[b.tier]);
  // Même ordre que le référentiel (PA, PM, Portée… → Initiative), comme la table des poids.
  return [...m.entries()].sort((a, b) => ALL_STAT_IDS.indexOf(a[0]) - ALL_STAT_IDS.indexOf(b[0]));
}

export function PagePrix() {
  const runes = useCatalogue((s) => s.runes);
  const parId = useCatalogue((s) => s.parId);
  const itemId = useSimu((s) => s.itemId);
  const lignes = useSimu((s) => s.lignes);
  const prix = useStorePrix((s) => s.prix);
  const { exporter, importer, toutEffacer } = useStorePrix();
  const item = itemId !== null ? parId.get(itemId) : undefined;

  // Onglet « objet » par défaut dès qu'un objet est sélectionné, tant que l'utilisateur n'a pas choisi.
  const [ongletChoisi, setOnglet] = useState<'objet' | 'toutes' | null>(null);
  const onglet = ongletChoisi ?? (item ? 'objet' : 'toutes');
  const [recherche, setRecherche] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const fichierRef = useRef<HTMLInputElement>(null);

  const statsObjet = useMemo(() => new Set(lignes.filter((l) => l.max > 0).map((l) => l.statId)), [lignes]);

  const visibles = useMemo(() => {
    if (onglet === 'objet') return runes.filter((r) => statsObjet.has(r.statId));
    const q = normaliser(recherche);
    if (q === '') return runes;
    return runes.filter((r) => normaliser(r.nom).includes(q) || normaliser(STAT_BY_ID[r.statId].label).includes(q));
  }, [runes, onglet, statsObjet, recherche]);

  const groupes = useMemo(() => grouperParStat(visibles), [visibles]);

  const nbRenseignes = Object.keys(prix).length;
  const nbPerimes = Object.values(prix).filter((p) => joursDepuis(p.date) > JOURS_PERIME).length;

  const telecharger = () => {
    const data = exporter(runes);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `prix-runes-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const charger = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = importer(JSON.parse(await f.text()), runes);
      setMessage(`${n} prix importés.`);
    } catch (e) {
      setMessage(`Import impossible : ${(e as Error).message}`);
    }
    if (fichierRef.current) fichierRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" className="segment">
          <button
            role="tab"
            aria-selected={onglet === 'objet'}
            onClick={() => setOnglet('objet')}
            disabled={!item}
            className={`rounded-l px-3 py-1 text-sm disabled:opacity-40 ${onglet === 'objet' ? 'bg-accent text-white dark:text-[#1a1208]' : ''}`}
          >
            {item ? `Runes de « ${item.nom} »` : 'Objet en cours'}
          </button>
          <button
            role="tab"
            aria-selected={onglet === 'toutes'}
            onClick={() => setOnglet('toutes')}
            className={`rounded-r px-3 py-1 text-sm ${onglet === 'toutes' ? 'bg-accent text-white dark:text-[#1a1208]' : ''}`}
          >
            Toutes les runes
          </button>
        </div>
        {onglet === 'toutes' && (
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Filtrer (Fo, Vitalité, Ra…)"
            className="champ w-56"
          />
        )}
        <span className="tnum text-xs text-encre-2">
          {nbRenseignes}/{runes.length} prix renseignés
          {nbPerimes > 0 && <span className="ml-1 text-alerte">· {nbPerimes} périmés (&gt; {JOURS_PERIME} j)</span>}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={telecharger} className="btn btn-petit">
            Exporter JSON
          </button>
          <button onClick={() => fichierRef.current?.click()} className="btn btn-petit">
            Importer JSON
          </button>
          <input ref={fichierRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void charger(e.target.files?.[0])} />
          {nbRenseignes > 0 && (
            <button
              onClick={() => {
                if (confirm('Effacer tous les prix enregistrés ?')) toutEffacer();
              }}
              className="btn btn-petit border-transparent text-ko hover:bg-ko-doux"
            >
              Tout effacer
            </button>
          )}
        </div>
      </div>

      {message && (
        <p className="rounded border border-info/40 bg-info-doux px-2 py-1 text-xs text-info">
          {message}{' '}
          <button onClick={() => setMessage(null)} className="ml-1 underline">
            ok
          </button>
        </p>
      )}

      {onglet === 'objet' && item && statsObjet.size === 0 && (
        <p className="text-sm text-encre-2">Cet objet n'a aucune ligne brisable.</p>
      )}

      {groupes.length > 0 && (
        <div className="carte px-2 pb-2">
          <table className="w-full">
            {groupes.map(([statId, rs]) => (
              <GroupeStat key={statId} statId={statId} runes={rs} />
            ))}
          </table>
        </div>
      )}

      <p className="text-xs text-encre-2">
        Les prix sont enregistrés immédiatement dans ce navigateur uniquement. Tab passe au champ suivant ;
        vider un champ supprime le prix.
      </p>
    </div>
  );
}
