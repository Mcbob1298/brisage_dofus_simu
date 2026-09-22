import { useMemo, useState } from 'react';
import { STAT_BY_ID, placeholderPour, type StatId } from '../data/statMapping.ts';
import type { Item } from '../data/types.ts';
import { alternatives, optimiser, scoreStats, statsItem, PRESETS, SLOTS, type Poids, type Slot } from '../engine/index.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import { ItemImage } from '../components/ItemImage.tsx';
import type { Onglet } from '../components/EnTete.tsx';
import { formatNombre } from '../lib/format.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { useGuide } from '../store/guide.ts';
import { usePerso } from '../store/perso.ts';

/** Caractéristiques affichées dans le récapitulatif, dans cet ordre. */
const RESUME: StatId[] = [
  'prospection',
  'vitalite',
  'sagesse',
  'pa',
  'pm',
  'portee',
  'puissance',
  'dommages',
  'pctCritique',
  'force',
  'intelligence',
  'chance',
  'agilite',
  'pods',
  'initiative',
];

function Ligne({ item, slot, poids, jet, panoplie, onRemplacer, onEpingler, epingle }: {
  item: Item;
  slot: Slot;
  panoplie?: string;
  poids: Poids;
  jet: 'min' | 'moyen' | 'max';
  onRemplacer: (slot: Slot, ancien: Item) => void;
  onEpingler: () => void;
  epingle: boolean;
}) {
  const stats = statsItem(item, jet);
  const apport = Object.entries(stats)
    .filter(([statId]) => (poids[statId as StatId] ?? 0) !== 0)
    .sort((a, b) => (poids[b[0] as StatId] ?? 0) * b[1] - (poids[a[0] as StatId] ?? 0) * a[1])
    .slice(0, 3);
  return (
    <li className="flex items-center gap-2 px-2 py-1 text-sm">
      <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={26} />
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-tight">{item.nom}</span>
        <span className="flex flex-wrap gap-1 text-[10px] text-encre-2">
          <span className="tnum">niv. {item.niveau}</span>
          {panoplie && (
            <span className="rounded bg-ok-doux px-1 text-ok" title="Portée pour le bonus de panoplie">
              {panoplie}
            </span>
          )}
          {apport.map(([statId, v]) => (
            <span key={statId} className="rounded bg-surface-2 px-1">
              {formatNombre(v)} {STAT_BY_ID[statId as StatId].label}
            </span>
          ))}
        </span>
      </span>
      <span className="tnum shrink-0 text-xs text-encre-2" title="Apport au score">
        {formatNombre(scoreStats(stats, poids), 1)}
      </span>
      <button
        onClick={onEpingler}
        className={`btn btn-petit shrink-0 px-1.5 ${epingle ? 'border-accent text-accent' : ''}`}
        title={epingle ? 'Ne plus imposer cet objet' : 'Je le possède déjà : garde-le'}
        aria-pressed={epingle}
      >
        {epingle ? '📌' : '📍'}
      </button>
      <button onClick={() => onRemplacer(slot, item)} className="btn btn-petit shrink-0 px-1.5" title="Voir les alternatives">
        ⇄
      </button>
    </li>
  );
}

export function PagePerso({ aller }: { aller: (o: Onglet) => void }) {
  const items = useCatalogue((s) => s.items);
  const panoplies = useCatalogue((s) => s.panoplies);
  const g = useGuide();
  const p = usePerso();
  const [choix, setChoix] = useState<{ slot: Slot; ancien: Item } | null>(null);

  const options = useMemo(
    () => ({ niveauJoueur: g.niveauJoueur, poids: p.poids, jet: p.jet, fixes: p.epingles, panoplies }),
    [g.niveauJoueur, p.poids, p.jet, p.epingles, panoplies],
  );
  const build = useMemo(() => optimiser(items, options), [items, options]);
  const alt = useMemo(() => (choix ? alternatives(items, choix.slot, options, 12) : []), [choix, items, options]);

  const prospection = Math.round(build.totaux.prospection ?? 0);
  const preset = PRESETS.find((x) => JSON.stringify(x.poids) === JSON.stringify(p.poids));
  const statsAffichees = RESUME.filter((s) => (build.totaux[s] ?? 0) !== 0);

  return (
    <div className="space-y-3">
      <section className="carte p-4">
        <h2 className="mb-2 text-base font-semibold">Mon personnage</h2>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2 text-xs text-encre-2">
          <label className="flex flex-col gap-0.5">
            Niveau
            <ChampNombre value={g.niveauJoueur} onChange={(v) => g.setNiveauJoueur(v ?? 1)} className="w-20" />
          </label>
          <label className="flex flex-col gap-0.5" title="Jets supposés des objets que tu portes">
            Jets
            <select value={p.jet} onChange={(e) => p.setJet(e.target.value as 'min' | 'moyen' | 'max')} className="champ">
              <option value="moyen">moyens</option>
              <option value="max">max</option>
              <option value="min">min</option>
            </select>
          </label>
          <span className="flex flex-col gap-0.5">
            Objectif
            <span className="segment" role="radiogroup" aria-label="Objectif du stuff">
              {PRESETS.map((x) => (
                <button key={x.id} role="radio" aria-checked={preset?.id === x.id} onClick={() => p.setPoids(x.poids)} title={x.aide}>
                  {x.label}
                </button>
              ))}
            </span>
          </span>
          <button onClick={() => p.reset()} className="btn btn-petit">
            ↺ Réinitialiser
          </button>
        </div>
        {preset && <p className="mt-1 text-xs text-encre-2">{preset.aide}</p>}
      </section>

      <section className="carte p-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold">Stuff proposé</h2>
          <span className="tnum text-sm">
            <strong className="text-accent">{formatNombre(prospection)}</strong> <span className="text-encre-2">prospection</span>
          </span>
          <button onClick={() => { g.setProspection(prospection); aller('guide'); }} className="btn btn-petit" disabled={prospection === 0}>
            Utiliser dans le farm →
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1 text-xs">
          {statsAffichees.map((s) => (
            <span key={s} className="tnum rounded bg-surface-2 px-1.5 py-0.5">
              {STAT_BY_ID[s].label} <strong>{formatNombre(build.totaux[s] ?? 0)}</strong>
            </span>
          ))}
        </div>

        {build.panoplies.length > 0 && (
          <p className="mb-2 rounded-lg border border-ok/40 bg-ok-doux px-2 py-1 text-xs">
            {build.panoplies.map((bp) => (
              <span key={bp.panoplie.id} className="mr-3">
                <strong>{bp.panoplie.nom}</strong> ({bp.pieces} pièces) :{' '}
                {bp.bonus.map((b) => `${formatNombre(b.valeur)} ${STAT_BY_ID[b.statId].label}`).join(', ')}
              </span>
            ))}
          </p>
        )}

        <div className="grid gap-2 md:grid-cols-2">
          {SLOTS.map((s) => {
            const portes = build.parSlot[s.id];
            return (
              <div key={s.id} className="rounded-lg border border-bord">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="titre-section">{s.label}</span>
                  <span className="tnum text-[11px] text-encre-2">
                    {portes.length}/{s.capacite}
                  </span>
                </div>
                <ul className="divide-y divide-bord border-t border-bord">
                  {portes.map((item) => (
                    <Ligne
                      key={item.id}
                      item={item}
                      slot={s.id}
                      poids={p.poids}
                      jet={p.jet}
                      panoplie={build.panoplies.find((bp) => bp.panoplie.id === item.panoplieId)?.panoplie.nom}
                      epingle={p.epingles.includes(item.id)}
                      onEpingler={() => p.basculerEpingle(item.id)}
                      onRemplacer={(slot, ancien) => setChoix({ slot, ancien })}
                    />
                  ))}
                  {portes.length === 0 && (
                    <li className="px-2 py-1 text-xs text-encre-2">
                      Rien d'utile à ton niveau pour cet objectif.{' '}
                      <button onClick={() => setChoix({ slot: s.id, ancien: null as unknown as Item })} className="lien">
                        voir quand même
                      </button>
                    </li>
                  )}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-encre-2">
          Le score est une somme pondérée des caractéristiques, pas la formule de dégâts du jeu (qui dépend de ta classe, de tes sorts et de la cible). Les bonus de
          panoplie sont cherchés par essais successifs : c'est une bonne proposition, pas forcément l'optimum absolu. Rien sur les conditions de quête ou de classe.
        </p>
      </section>

      {choix && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={() => setChoix(null)}>
          <div className="carte max-h-[80vh] w-full max-w-lg overflow-y-auto p-3" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold">{SLOTS.find((s) => s.id === choix.slot)?.label}</h3>
              <button onClick={() => setChoix(null)} className="btn btn-petit">
                fermer
              </button>
            </div>
            <ul className="divide-y divide-bord">
              {alt.map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-1 text-sm">
                  <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={24} />
                  <span className="min-w-0 flex-1 truncate">
                    {item.nom} <span className="tnum text-[11px] text-encre-2">niv. {item.niveau}</span>
                  </span>
                  <span className="tnum text-xs text-encre-2">{formatNombre(scoreStats(statsItem(item, p.jet), p.poids), 1)}</span>
                  <button
                    onClick={() => {
                      if (choix.ancien) p.retirerEpingle(choix.ancien.id);
                      p.ajouterEpingle(item.id);
                      setChoix(null);
                    }}
                    className="btn btn-petit"
                  >
                    porter
                  </button>
                </li>
              ))}
              {alt.length === 0 && <li className="py-1 text-xs text-encre-2">Aucun objet disponible à ton niveau.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
