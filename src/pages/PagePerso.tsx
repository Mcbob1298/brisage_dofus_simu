import { useMemo, useState } from 'react';
import { STAT_BY_ID, placeholderPour, type StatId } from '../data/statMapping.ts';
import type { Item } from '../data/types.ts';
import {
  alternatives,
  optimiser,
  poidsElement,
  progression,
  scoreStats,
  statsItem,
  ELEMENTS,
  SLOTS,
  type Element,
  type Poids,
  type Slot,
} from '../engine/index.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import { ItemImage } from '../components/ItemImage.tsx';
import type { Onglet } from '../components/EnTete.tsx';
import { formatNombre } from '../lib/format.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { useGuide } from '../store/guide.ts';
import { usePerso, type Objectif } from '../store/perso.ts';

/** Caractéristiques du récapitulatif, dans l'ordre d'une fiche de personnage. */
const RESUME: StatId[] = [
  'vitalite',
  'pa',
  'pm',
  'portee',
  'prospection',
  'sagesse',
  'puissance',
  'dommages',
  'pctCritique',
  'force',
  'intelligence',
  'chance',
  'agilite',
  'initiative',
  'pods',
];

const OBJECTIFS: { id: Objectif; label: string; aide: string }[] = [
  { id: 'prospection', label: 'Prospection', aide: 'Maximise les taux de drop : plus d’objets ramassés, donc plus de runes.' },
  { id: 'degats', label: 'Dégâts', aide: 'Oriente le stuff vers ton élément : caractéristique, dommages, PA/PM, critique.' },
  { id: 'mixte', label: 'Mixte', aide: 'Dégâts de ton élément, avec la prospection comptée à part égale — pour farmer en tapant fort.' },
];

/** Une case d'équipement, façon inventaire. */
function Case({
  item,
  poids,
  jet,
  panoplie,
  epingle,
  onEpingler,
  onRemplacer,
}: {
  item: Item | null;
  poids: Poids;
  jet: 'min' | 'moyen' | 'max';
  panoplie?: string;
  epingle?: boolean;
  onEpingler?: () => void;
  onRemplacer: () => void;
}) {
  if (!item) {
    return (
      <button
        onClick={onRemplacer}
        className="flex h-14 w-full items-center justify-center rounded-lg border border-dashed border-bord-fort text-xs text-encre-3 hover:bg-surface-2"
      >
        vide — choisir
      </button>
    );
  }
  const stats = statsItem(item, jet);
  const apport = Object.entries(stats)
    .filter(([s]) => (poids[s as StatId] ?? 0) !== 0)
    .sort((a, b) => (poids[b[0] as StatId] ?? 0) * b[1] - (poids[a[0] as StatId] ?? 0) * a[1])
    .slice(0, 2);
  return (
    <div className="flex h-14 items-center gap-2 rounded-lg border border-bord bg-surface-2/60 px-2">
      <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={30} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm leading-tight">{item.nom}</span>
        <span className="flex flex-wrap gap-1 text-[10px] text-encre-2">
          <span className="tnum">niv. {item.niveau}</span>
          {panoplie && <span className="rounded bg-ok-doux px-1 text-ok">{panoplie}</span>}
          {apport.map(([s, v]) => (
            <span key={s} className="rounded bg-surface px-1">
              {formatNombre(v)} {STAT_BY_ID[s as StatId].label}
            </span>
          ))}
        </span>
      </span>
      {onEpingler && (
        <button
          onClick={onEpingler}
          className={`btn btn-petit shrink-0 px-1 ${epingle ? 'border-accent text-accent' : ''}`}
          title={epingle ? 'Ne plus imposer cet objet' : 'Je le possède déjà : garde-le'}
          aria-pressed={epingle}
        >
          {epingle ? '📌' : '📍'}
        </button>
      )}
      <button onClick={onRemplacer} className="btn btn-petit shrink-0 px-1" title="Changer">
        ⇄
      </button>
    </div>
  );
}

function Colonne({ slots, children }: { slots: Slot[]; children: (slot: Slot, index: number) => React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {slots.map((s, i) => (
        <div key={`${s}-${i}`}>
          <div className="mb-0.5 titre-section">{SLOTS.find((x) => x.id === s)?.label}</div>
          {children(s, i)}
        </div>
      ))}
    </div>
  );
}

export function PagePerso({ aller }: { aller: (o: Onglet) => void }) {
  const items = useCatalogue((s) => s.items);
  const panoplies = useCatalogue((s) => s.panoplies);
  const classes = useCatalogue((s) => s.classes);
  const g = useGuide();
  const p = usePerso();
  const [choix, setChoix] = useState<{ slot: Slot; ancien: Item | null } | null>(null);
  const [voirProgression, setVoirProgression] = useState(true);

  const poids: Poids = useMemo(() => {
    if (p.objectif === 'prospection') return { prospection: 1, vitalite: 0.02 };
    if (p.objectif === 'mixte') return poidsElement(p.element, 60);
    return poidsElement(p.element);
  }, [p.objectif, p.element]);

  const options = useMemo(
    () => ({ niveauJoueur: g.niveauJoueur, poids, jet: p.jet, fixes: p.epingles, panoplies }),
    [g.niveauJoueur, poids, p.jet, p.epingles, panoplies],
  );
  const build = useMemo(() => optimiser(items, options), [items, options]);
  const alt = useMemo(() => (choix ? alternatives(items, choix.slot, options, 15) : []), [choix, items, options]);
  const etapes = useMemo(() => progression(items, options).slice(0, 25), [items, options]);

  const prospection = Math.round(build.totaux.prospection ?? 0);
  const objectif = OBJECTIFS.find((o) => o.id === p.objectif)!;
  const classe = classes.find((c) => c.id === p.classeId);

  const placer = (slot: Slot, i: number): Item | null => build.parSlot[slot][i] ?? null;
  const nomPanoplie = (item: Item | null) =>
    item ? build.panoplies.find((bp) => bp.panoplie.id === item.panoplieId)?.panoplie.nom : undefined;

  const caseDe = (slot: Slot, i = 0) => {
    const item = placer(slot, i);
    return (
      <Case
        item={item}
        poids={poids}
        jet={p.jet}
        panoplie={nomPanoplie(item)}
        epingle={item ? p.epingles.includes(item.id) : false}
        onEpingler={item ? () => p.basculerEpingle(item.id) : undefined}
        onRemplacer={() => setChoix({ slot, ancien: item })}
      />
    );
  };

  return (
    <div className="space-y-3">
      {/* Fiche */}
      <section className="carte p-4">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <label className="flex flex-col gap-0.5 text-xs text-encre-2">
            Classe
            <select value={p.classeId ?? ''} onChange={(e) => p.setClasse(e.target.value ? Number(e.target.value) : null)} className="champ w-36">
              <option value="">—</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-encre-2">
            Niveau
            <ChampNombre value={g.niveauJoueur} onChange={(v) => g.setNiveauJoueur(v ?? 1)} className="w-20" />
          </label>
          <span className="flex flex-col gap-0.5 text-xs text-encre-2">
            Élément visé
            <span className="segment" role="radiogroup" aria-label="Élément">
              {ELEMENTS.map((e) => (
                <button
                  key={e.id}
                  role="radio"
                  aria-checked={p.element === e.id}
                  onClick={() => p.setElement(e.id as Element)}
                  title={`${e.label} — ${STAT_BY_ID[e.stat].label}`}
                >
                  {e.label}
                </button>
              ))}
            </span>
          </span>
          <span className="flex flex-col gap-0.5 text-xs text-encre-2">
            Objectif du stuff
            <span className="segment" role="radiogroup" aria-label="Objectif">
              {OBJECTIFS.map((o) => (
                <button key={o.id} role="radio" aria-checked={p.objectif === o.id} onClick={() => p.setObjectif(o.id)} title={o.aide}>
                  {o.label}
                </button>
              ))}
            </span>
          </span>
          <label className="flex flex-col gap-0.5 text-xs text-encre-2" title="Jets supposés des objets portés">
            Jets
            <select value={p.jet} onChange={(e) => p.setJet(e.target.value as 'min' | 'moyen' | 'max')} className="champ w-24">
              <option value="moyen">moyens</option>
              <option value="max">max</option>
              <option value="min">min</option>
            </select>
          </label>
          <button onClick={() => p.reset()} className="btn btn-petit">
            ↺ Réinitialiser
          </button>
        </div>
        <p className="mt-1 text-xs text-encre-2">
          {classe ? `${classe.nom} niveau ${g.niveauJoueur}` : `Niveau ${g.niveauJoueur}`} · voie {ELEMENTS.find((e) => e.id === p.element)?.label} ({
            STAT_BY_ID[ELEMENTS.find((e) => e.id === p.element)!.stat].label
          }) — {objectif.aide}
        </p>
      </section>

      {/* Équipement */}
      <section className="carte p-4">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-base font-semibold">Équipement proposé</h2>
          <span className="tnum text-sm">
            <strong className="text-accent">{formatNombre(prospection)}</strong> <span className="text-encre-2">prospection</span>
          </span>
          <button onClick={() => { g.setProspection(prospection); aller('guide'); }} className="btn btn-petit" disabled={prospection === 0}>
            Utiliser dans le farm →
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_minmax(11rem,auto)_1fr]">
          <Colonne slots={['coiffe', 'amulette', 'anneau', 'ceinture']}>{(s, i) => caseDe(s, s === 'anneau' ? 0 : i * 0)}</Colonne>

          <div className="order-first flex flex-col justify-center gap-2 rounded-xl border border-bord bg-surface-2/50 p-3 text-center md:order-none">
            <div className="text-2xl">🧍</div>
            <div className="text-sm font-semibold">{classe?.nom ?? 'Personnage'}</div>
            <div className="tnum text-xs text-encre-2">niveau {g.niveauJoueur}</div>
            <ul className="mt-1 space-y-0.5 text-left text-xs">
              {RESUME.filter((s) => (build.totaux[s] ?? 0) !== 0).map((s) => (
                <li key={s} className="flex justify-between gap-2">
                  <span className="text-encre-2">{STAT_BY_ID[s].label}</span>
                  <span className="tnum font-medium">{formatNombre(build.totaux[s] ?? 0)}</span>
                </li>
              ))}
            </ul>
          </div>

          <Colonne slots={['cape', 'bottes', 'anneau', 'bouclier']}>{(s) => caseDe(s, s === 'anneau' ? 1 : 0)}</Colonne>
        </div>

        <div className="mt-3">
          <div className="mb-0.5 titre-section">Arme</div>
          {caseDe('arme')}
        </div>

        <div className="mt-3">
          <div className="mb-0.5 titre-section">Dofus / Trophées ({build.parSlot.dofus.length}/6)</div>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i}>{caseDe('dofus', i)}</div>
            ))}
          </div>
        </div>

        {build.panoplies.length > 0 && (
          <p className="mt-3 rounded-lg border border-ok/40 bg-ok-doux px-2 py-1 text-xs">
            {build.panoplies.map((bp) => (
              <span key={bp.panoplie.id} className="mr-3">
                <strong>{bp.panoplie.nom}</strong> ({bp.pieces} pièces) :{' '}
                {bp.bonus.map((b) => `${formatNombre(b.valeur)} ${STAT_BY_ID[b.statId].label}`).join(', ')}
              </span>
            ))}
          </p>
        )}
      </section>

      {/* Progression */}
      <section className="carte p-4">
        <button onClick={() => setVoirProgression((v) => !v)} className="flex w-full items-baseline justify-between" aria-expanded={voirProgression}>
          <h2 className="text-base font-semibold">
            Prochains équipements <span className="text-sm font-normal text-encre-2">({etapes.length} à venir)</span>
          </h2>
          <span className="text-encre-2">{voirProgression ? '▾' : '▸'}</span>
        </button>
        {voirProgression &&
          (etapes.length === 0 ? (
            <p className="mt-2 text-sm text-encre-2">Rien de mieux à débloquer plus haut pour cet objectif : ton stuff est déjà au plafond du catalogue.</p>
          ) : (
            <ol className="mt-2 space-y-1">
              {etapes.map((e) => (
                <li key={`${e.slot}-${e.item.id}`} className="flex items-center gap-2 border-t border-bord py-1 text-sm">
                  <span className="tnum w-14 shrink-0 rounded bg-accent-doux px-1 text-center text-xs font-semibold text-accent">niv. {e.niveau}</span>
                  <ItemImage src={e.item.imageLocale} alt="" fallback={placeholderPour(e.item.type, e.item.famille)} taille={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate leading-tight">{e.item.nom}</span>
                    <span className="block truncate text-[11px] text-encre-2">
                      {SLOTS.find((s) => s.id === e.slot)?.label}
                      {e.remplace ? ` · remplace ${e.remplace.nom}` : ' · emplacement vide aujourd’hui'}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-xs text-ok" title="Gain de score par rapport à l'objet remplacé">
                    +{formatNombre(e.gain, 1)}
                  </span>
                </li>
              ))}
            </ol>
          ))}
      </section>

      <p className="text-xs text-encre-2">
        Le score est une somme pondérée des caractéristiques, pas la formule de dégâts du jeu (qui dépend de ta classe, de tes sorts et de la cible) : la classe sert
        ici de repère, l'élément oriente les poids. Les bonus de panoplie sont cherchés par essais successifs, et la liste des prochains équipements les ignore.
        Aucune condition de quête n'est vérifiée : contrôle en jeu avant d'acheter.
      </p>

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
                  <span className="tnum text-xs text-encre-2">{formatNombre(scoreStats(statsItem(item, p.jet), poids), 1)}</span>
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
              {alt.length === 0 && <li className="py-1 text-xs text-encre-2">Aucun objet utile à ton niveau pour cet objectif.</li>}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
