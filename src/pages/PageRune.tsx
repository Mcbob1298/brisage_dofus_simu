import { useMemo, useState } from 'react';
import { STAT_BY_ID, placeholderPour } from '../data/statMapping.ts';
import type { RuneDef } from '../data/types.ts';
import { ciblerRune, type JetChoisi } from '../engine/index.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import type { Onglet } from '../components/EnTete.tsx';
import { ItemImage } from '../components/ItemImage.tsx';
import { RuneImage } from '../components/RuneImage.tsx';
import { useEstimation } from '../hooks/useEstimation.ts';
import { useContexte } from '../hooks/useSimulation.ts';
import { formatKamas, formatNombre, formatPct } from '../lib/format.ts';
import { normaliser } from '../lib/normaliser.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { useGuide } from '../store/guide.ts';
import { useNotes } from '../store/notes.ts';
import { useSimu } from '../store/simu.ts';
import { useStorePrix } from '../store/prix.ts';

type Acquisition = 'tout' | 'drop' | 'craft';
type Tri = 'runes' | 'sansFocus' | 'niveau' | 'cout' | 'parRune' | 'nom';

/** Partir d'une rune et trouver les objets à briser pour l'obtenir. */
export function PageRune({ aller }: { aller: (o: Onglet) => void }) {
  const items = useCatalogue((s) => s.items);
  const runes = useCatalogue((s) => s.runes);
  const monstres = useCatalogue((s) => s.monstres);
  const ctx = useContexte();
  const prix = useStorePrix((s) => s.prix);
  const g = useGuide();
  const setPrixConstate = useNotes((s) => s.setPrixConstate);
  const estimateur = useEstimation();
  const { choisirObjet, setChamp, setFocus } = useSimu();

  const [runeId, setRuneId] = useState<number | null>(null);
  const [recherche, setRecherche] = useState('');
  const [jet, setJet] = useState<JetChoisi>('moyen');
  const [niveauMax, setNiveauMax] = useState<number | null>(null);
  const [acquisition, setAcquisition] = useState<Acquisition>('tout');
  const [typeObjet, setTypeObjet] = useState('');
  const [rechercheObjet, setRechercheObjet] = useState('');
  const [tri, setTri] = useState<Tri>('runes');
  const [desc, setDesc] = useState(true);
  const [limite, setLimite] = useState(25);

  // Runes triées par prix renseigné : les plus chères d'abord, ce sont les cibles.
  const runesTriees = useMemo(() => {
    const q = normaliser(recherche);
    return [...runes]
      .filter((r) => q === '' || normaliser(r.nom).includes(q) || normaliser(STAT_BY_ID[r.statId].label).includes(q))
      .sort((a, b) => (prix[b.id]?.prix ?? -1) - (prix[a.id]?.prix ?? -1) || a.nom.localeCompare(b.nom, 'fr'));
  }, [runes, recherche, prix]);

  const rune: RuneDef | null = runeId !== null ? (runes.find((r) => r.id === runeId) ?? null) : null;

  // Prix noté quand il existe, sinon estimé d'après les relevés de l'utilisateur.
  const couts = useMemo(() => {
    const out: Record<number, number> = {};
    for (const it of items) {
      const c = estimateur.cout(it);
      if (c) out[it.id] = c.prix;
    }
    return out;
  }, [items, estimateur]);

  const pistes = useMemo(() => {
    if (!rune) return [];
    const toutes = ciblerRune(rune, items, ctx, {
      coefficient: g.coefSuppose,
      jet,
      niveauMax: niveauMax ?? undefined,
      couts,
      prospection: g.prospection,
    }, monstres);
    return toutes;
  }, [rune, items, ctx, g.coefSuppose, g.prospection, jet, niveauMax, couts, monstres]);

  /** Types présents dans les résultats, pour ne proposer que des filtres utiles. */
  const typesDisponibles = useMemo(
    () => [...new Set(pistes.map((p) => p.item.type))].sort((a, b) => a.localeCompare(b, 'fr')),
    [pistes],
  );

  const visibles = useMemo(() => {
    const q = normaliser(rechercheObjet);
    const filtrees = pistes.filter((p) => {
      if (acquisition === 'drop' && p.drops.length === 0) return false;
      if (acquisition === 'craft' && !p.craftable) return false;
      if (typeObjet && p.item.type !== typeObjet) return false;
      if (q && !normaliser(p.item.nom).includes(q)) return false;
      return true;
    });
    const cle = (p: (typeof pistes)[number]): number | string => {
      switch (tri) {
        case 'sansFocus':
          return p.quantiteNaturel;
        case 'niveau':
          return p.item.niveau;
        case 'cout':
          return p.cout ?? Infinity;
        case 'parRune':
          // Un coût inconnu ne doit pas passer devant : il part en fin de tri.
          return p.coutParRune ?? (desc ? -Infinity : Infinity);
        case 'nom':
          return p.item.nom;
        default:
          return p.quantiteFocus;
      }
    };
    return [...filtrees].sort((a, b) => {
      const ka = cle(a);
      const kb = cle(b);
      const c = typeof ka === 'string' ? ka.localeCompare(kb as string, 'fr') : ka - (kb as number);
      return (desc ? -c : c) || a.item.nom.localeCompare(b.item.nom, 'fr');
    });
  }, [pistes, acquisition, typeObjet, rechercheObjet, tri, desc]);

  const trierPar = (t: Tri) => {
    if (tri === t) setDesc((d) => !d);
    else {
      setTri(t);
      // Le nom se lit de A à Z, les chiffres du plus grand au plus petit — sauf un coût, qu'on veut bas.
      setDesc(t !== 'nom' && t !== 'cout' && t !== 'parRune');
    }
  };

  const EnTeteTri = ({ t, label, title }: { t: Tri; label: string; title?: string }) => (
    <button onClick={() => trierPar(t)} className="hover:underline" title={title}>
      {label}
      {tri === t && <span className="ml-0.5">{desc ? '▼' : '▲'}</span>}
    </button>
  );

  const prixRune = rune ? prix[rune.id]?.prix : undefined;

  return (
    <div className="space-y-3">
      <section className="carte p-4">
        <h2 className="mb-2 text-base font-semibold">Quelle rune cherches-tu ?</h2>
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2 text-xs text-encre-2">
          <label className="flex flex-col gap-0.5">
            Filtrer
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Ga Pa, Do Per Di, Critique…"
              className="champ w-56"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            Rune ciblée
            <select value={runeId ?? ''} onChange={(e) => setRuneId(e.target.value ? Number(e.target.value) : null)} className="champ w-72">
              <option value="">— choisis une rune —</option>
              {runesTriees.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nom} — {STAT_BY_ID[r.statId].label}
                  {prix[r.id] ? ` · ${formatKamas(prix[r.id]!.prix)}` : ' · prix ?'}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5" title="Jets supposés des objets : moyens pour de l'achat ou du drop, max si tu craftes">
            Jets
            <select value={jet} onChange={(e) => setJet(e.target.value as JetChoisi)} className="champ w-24">
              <option value="moyen">moyens</option>
              <option value="max">max</option>
              <option value="min">min</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5">
            Niveau max
            <ChampNombre value={niveauMax} onChange={setNiveauMax} vide placeholder="tous" className="w-20" />
          </label>
          <span className="tnum pb-2">coef. supposé {formatPct(g.coefSuppose, 0)}</span>
        </div>

        {rune && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <RuneImage rune={rune} taille={28} />
            <strong>{rune.nom}</strong>
            <span className="text-encre-2">
              {STAT_BY_ID[rune.statId].label} · 1 rune = {formatNombre(rune.valeur)} point(s)
            </span>
            {prixRune === undefined ? (
              <button onClick={() => aller('prix')} className="lien">
                prix non renseigné →
              </button>
            ) : (
              <span className="tnum">· {formatKamas(prixRune)} l'unité</span>
            )}
            <span className="tnum ml-auto text-encre-2">{formatNombre(pistes.length)} objet(s) en produisent</span>
          </p>
        )}
      </section>

      {rune && (
        <section className="carte">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-bord px-3 py-2 text-xs text-encre-2">
            <input
              type="search"
              value={rechercheObjet}
              onChange={(e) => setRechercheObjet(e.target.value)}
              placeholder="Filtrer par nom d'objet…"
              className="champ h-7 w-52"
              aria-label="Filtrer par nom d'objet"
            />
            <label className="flex items-center gap-1">
              Type
              <select value={typeObjet} onChange={(e) => setTypeObjet(e.target.value)} className="champ h-7" aria-label="Filtrer par type d'objet">
                <option value="">tous</option>
                {typesDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <span className="segment" role="radiogroup" aria-label="Où le trouver">
              {(
                [
                  ['tout', 'Tout'],
                  ['drop', 'Dropable'],
                  ['craft', 'Craftable'],
                ] as [Acquisition, string][]
              ).map(([id, label]) => (
                <button key={id} role="radio" aria-checked={acquisition === id} onClick={() => setAcquisition(id)}>
                  {label}
                </button>
              ))}
            </span>
            <span className="tnum ml-auto">
              {formatNombre(visibles.length)} objet(s)
              {visibles.length !== pistes.length && <span className="text-encre-3"> sur {formatNombre(pistes.length)}</span>}
            </span>
            {(typeObjet || rechercheObjet || acquisition !== 'tout') && (
              <button
                onClick={() => {
                  setTypeObjet('');
                  setRechercheObjet('');
                  setAcquisition('tout');
                }}
                className="lien"
              >
                ↺ tout afficher
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-encre-2">
              <tr className="border-b border-bord">
                <th className="px-2 py-1.5 font-medium">
                  <EnTeteTri t="nom" label="Objet" />
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  <EnTeteTri t="niveau" label="Niv." />
                </th>
                <th className="px-2 py-1.5 text-right font-medium" title="Jet de la ligne ciblée">
                  Ligne
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  <EnTeteTri t="runes" label="Runes (focus)" title={`Runes obtenues en focalisant sur ${STAT_BY_ID[rune.statId].label}`} />
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  <EnTeteTri t="sansFocus" label="Sans focus" title="Sans focus, le reste de l'objet est aussi converti" />
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  <EnTeteTri t="cout" label="Coût noté" title="Prix relevé, ou estimation d'après tes relevés" />
                </th>
                <th className="px-2 py-1.5 text-right font-medium">
                  <EnTeteTri t="parRune" label="Par rune" title="Coût d'acquisition ÷ runes obtenues" />
                </th>
                <th className="px-2 py-1.5 font-medium">Où le trouver</th>
                <th className="px-2 py-1.5"></th>
              </tr>
            </thead>
            <tbody>
              {visibles.slice(0, limite).map((p) => {
                const gagnant = prixRune !== undefined && p.coutParRune !== null && p.coutParRune < prixRune;
                const note = estimateur.coutNote(p.item);
                const estime = note === null && p.cout !== null;
                return (
                  <tr key={p.item.id} className="border-t border-bord">
                    <td className="px-2 py-1">
                      <span className="flex items-center gap-2">
                        <ItemImage src={p.item.imageLocale} alt="" fallback={placeholderPour(p.item.type, p.item.famille)} taille={24} />
                        <span className="min-w-0">
                          <span className="block truncate">{p.item.nom}</span>
                          <span className="block text-[11px] text-encre-2">{p.item.type}</span>
                        </span>
                      </span>
                    </td>
                    <td className="tnum px-2 py-1 text-right">{p.item.niveau}</td>
                    <td className="tnum px-2 py-1 text-right text-encre-2">{formatNombre(p.jet)}</td>
                    <td className="tnum px-2 py-1 text-right font-medium">{formatNombre(p.quantiteFocus, 1)}</td>
                    <td className="tnum px-2 py-1 text-right text-encre-2">{formatNombre(p.quantiteNaturel, 1)}</td>
                    <td className="px-2 py-1 text-right">
                      <ChampNombre
                        value={note}
                        onChange={(v) => setPrixConstate(p.item.id, v)}
                        vide
                        placeholder={estime ? `≈ ${formatNombre(p.cout ?? 0)}` : 'HDV'}
                        className={`w-24 [&>input]:h-7 ${estime ? '[&>input]:text-encre-3' : ''}`}
                        aria-label={`Coût ${p.item.nom}`}
                        title={estime ? "Estimation d'après tes prix relevés — note le prix réel pour la remplacer" : undefined}
                      />
                    </td>
                    <td className={`tnum px-2 py-1 text-right ${gagnant && !estime ? 'font-medium text-ok' : ''} ${estime ? 'text-encre-3' : ''}`}>
                      {p.coutParRune === null ? '—' : `${estime ? '≈ ' : ''}${formatKamas(p.coutParRune)}`}
                    </td>
                    <td className="px-2 py-1 text-xs">
                      {p.drops.length > 0 ? (
                        <span title={p.drops.map((d) => `${d.monstre.nom} ${formatPct(d.taux, 2)}`).join(' · ')}>
                          <span className="tnum">{formatPct(p.drops[0].taux, p.drops[0].taux < 1 ? 2 : 1)}</span> {p.drops[0].monstre.nom}
                          {p.drops.length > 1 && <span className="text-encre-2"> +{p.drops.length - 1}</span>}
                          {p.drops[0].monstre.zones[0] && <span className="block text-[10px] text-encre-2">{p.drops[0].monstre.zones[0]}</span>}
                        </span>
                      ) : p.craftable ? (
                        <span className="text-encre-2">craft ou HDV</span>
                      ) : (
                        <span className="text-encre-3">HDV</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-right">
                      <button
                        onClick={() => {
                          choisirObjet(p.item);
                          setChamp('coefficient', g.coefSuppose);
                          if (p.cout !== null) setChamp('prixRevient', p.cout);
                          setFocus(rune.statId);
                          aller('objet');
                        }}
                        className="text-xs lien"
                      >
                        simuler →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
          {visibles.length > limite && (
            <div className="border-t border-bord p-2 text-center">
              <button onClick={() => setLimite((l) => l + 25)} className="lien text-xs">
                Afficher 25 de plus ({formatNombre(visibles.length - limite)} restants)
              </button>
            </div>
          )}
          {visibles.length === 0 && <p className="p-3 text-sm text-encre-2">Aucun objet ne correspond à ces filtres.</p>}
        </section>
      )}

      {!rune && (
        <p className="text-sm text-encre-2">
          Choisis une rune ci-dessus : l'app liste les objets qui la produisent, combien tu en tires avec un focus sur cette ligne, et où les trouver.
        </p>
      )}

      {rune && (
        <p className="text-xs text-encre-2">
          {estimateur.calibration.parNiveau === null ? (
            <>
              Aucune API ne donne les prix HDV : note quelques prix (ici ou dans le Guide) et l'app estimera les autres à partir de tes relevés.{' '}
            </>
          ) : (
            <>
              Les coûts en gris sont des <strong>estimations</strong> tirées de tes {estimateur.calibration.nbReleves} prix relevés (
              {formatNombre(estimateur.calibration.parNiveau, 1)} kamas par niveau en médiane
              {estimateur.calibration.parType.size > 0 ? `, affinée pour ${estimateur.calibration.parType.size} type(s)` : ''}) — un ordre de grandeur, pas
              une cote.{' '}
            </>
          )}
          Quantités calculées au coefficient supposé ({formatPct(g.coefSuppose, 0)}, réglable dans le Guide) avec un focus sur {STAT_BY_ID[rune.statId].label} : les
          autres lignes sont détruites et ne reversent que la moitié de leur poids. Les décimales sont des probabilités, pas des runes garanties. Les taux de drop
          tiennent compte de ta prospection ({formatNombre(g.prospection)}).
        </p>
      )}
    </div>
  );
}
