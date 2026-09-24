import { useMemo, useState } from 'react';
import { STAT_BY_ID, placeholderPour } from '../data/statMapping.ts';
import type { Item } from '../data/types.ts';
import { evaluerCatalogue, type EvaluationItem, type JetChoisi } from '../engine/index.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import { ItemImage } from '../components/ItemImage.tsx';
import type { Onglet } from '../components/EnTete.tsx';
import { useContexte } from '../hooks/useSimulation.ts';
import { formatKamas, formatNombre, formatPct } from '../lib/format.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { dernierCoef, useNotes } from '../store/notes.ts';
import { useSimu } from '../store/simu.ts';

type Tri = 'valeurMeilleure' | 'valeurNaturel' | 'niveau' | 'densite' | 'nom' | 'marge';
const PAGE = 100;

function PrixConstate({ item }: { item: Item }) {
  const prix = useNotes((s) => s.prixConstates[item.id]?.prix ?? null);
  const setPrixConstate = useNotes((s) => s.setPrixConstate);
  return <ChampNombre value={prix} onChange={(v) => setPrixConstate(item.id, v)} vide placeholder="—" className="w-24 [&>input]:h-7" aria-label={`Prix constaté ${item.nom}`} />;
}

export function PageExplorateur({ aller }: { aller: (o: Onglet) => void }) {
  const items = useCatalogue((s) => s.items);
  const index = useCatalogue((s) => s.index);
  const meta = useCatalogue((s) => s.meta);
  const ctx = useContexte();
  const taxePct = useSimu((s) => s.taxePct);
  const { choisirObjet, setChamp, setFocus } = useSimu();
  const coefs = useNotes((s) => s.coefs);
  const prixConstates = useNotes((s) => s.prixConstates);

  const [jet, setJet] = useState<JetChoisi>('max');
  const [type, setType] = useState<string>('');
  const [niveauMin, setNiveauMin] = useState<number | null>(null);
  const [niveauMax, setNiveauMax] = useState<number | null>(null);
  const [valeurMin, setValeurMin] = useState<number | null>(null);
  const [masquerDroppables, setMasquerDroppables] = useState(false);
  const [masquerSansPrix, setMasquerSansPrix] = useState(false);
  const [colDensite, setColDensite] = useState(false);
  // Objets liés ou de quête : le concasseur les refuse.
  const [inclureNonBrisables, setInclureNonBrisables] = useState(false);
  const [tri, setTri] = useState<Tri>('valeurMeilleure');
  const [desc, setDesc] = useState(true);
  const [limite, setLimite] = useState(PAGE);

  const nbPrix = Object.keys(ctx.prix).length;

  // Évaluation complète du catalogue : recalculée seulement si prix / poids / mode / jet changent.
  const evaluations = useMemo(() => evaluerCatalogue(items, ctx, jet), [items, ctx, jet]);

  const lignes = useMemo(() => {
    const net = (v: number) => v * (1 - taxePct / 100);
    const marge = (e: EvaluationItem) => {
      const p = prixConstates[e.item.id]?.prix;
      return p === undefined ? null : net(e.valeurMeilleure) - p;
    };
    let l = evaluations.filter((e) => {
      const it = e.item;
      if (type === 'Arme' ? it.famille !== 'Arme' : type && it.type !== type) return false;
      if (niveauMin !== null && it.niveau < niveauMin) return false;
      if (niveauMax !== null && it.niveau > niveauMax) return false;
      if (valeurMin !== null && e.valeurMeilleure < valeurMin) return false;
      if (masquerDroppables && it.droppable === true) return false;
      if (masquerSansPrix && e.prixManquants) return false;
      if (!inclureNonBrisables && it.nonBrisable) return false;
      return it.stats.length > 0;
    });
    const cle = (e: EvaluationItem): number | string => {
      switch (tri) {
        case 'valeurNaturel':
          return e.valeurNaturel;
        case 'niveau':
          return e.item.niveau;
        case 'densite':
          return e.valeurMeilleure / Math.max(1, e.item.niveau);
        case 'nom':
          return e.item.nom;
        case 'marge':
          return marge(e) ?? -Infinity;
        default:
          return e.valeurMeilleure;
      }
    };
    l = l.sort((a, b) => {
      const ka = cle(a);
      const kb = cle(b);
      const c = typeof ka === 'string' ? ka.localeCompare(kb as string, 'fr') : ka - (kb as number);
      return (desc ? -c : c) || a.item.nom.localeCompare(b.item.nom, 'fr');
    });
    return { total: l.length, visibles: l.slice(0, limite), marge };
  }, [evaluations, type, niveauMin, niveauMax, valeurMin, masquerDroppables, masquerSansPrix, inclureNonBrisables, tri, desc, limite, prixConstates, taxePct]);

  const trierPar = (t: Tri) => {
    if (tri === t) setDesc((d) => !d);
    else {
      setTri(t);
      setDesc(t !== 'nom');
    }
  };

  const simuler = (e: EvaluationItem) => {
    choisirObjet(e.item);
    setChamp('prixRevient', prixConstates[e.item.id]?.prix ?? 0);
    setFocus(e.meilleurFocus);
    aller('objet');
  };

  const En = ({ t, label, right = true, title }: { t: Tri; label: string; right?: boolean; title?: string }) => (
    <th className={`px-2 py-1.5 font-medium ${right ? 'text-right' : 'text-left'}`}>
      <button onClick={() => trierPar(t)} className="hover:underline" title={title}>
        {label}
        {tri === t && <span className="ml-0.5">{desc ? '▼' : '▲'}</span>}
      </button>
    </th>
  );

  return (
    <div className="space-y-3">
      {nbPrix === 0 && (
        <p className="rounded border border-alerte/40 bg-alerte-doux px-2 py-1 text-sm text-alerte">
          Aucun prix de rune renseigné : toutes les valeurs sont à 0.{' '}
          <button onClick={() => aller('prix')} className="underline">
            Renseigner les prix
          </button>
        </p>
      )}

      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 text-xs text-encre-2">
        <label className="flex flex-col gap-0.5">
          Type
          <select value={type} onChange={(e) => setType(e.target.value)} className="champ">
            <option value="">Tous</option>
            <option value="Arme">Toutes armes</option>
            {index?.types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          Niveau
          <span className="flex items-center gap-1">
            <ChampNombre value={niveauMin} onChange={setNiveauMin} vide placeholder="min" className="w-16" />
            –
            <ChampNombre value={niveauMax} onChange={setNiveauMax} vide placeholder="max" className="w-16" />
          </span>
        </label>
        <label className="flex flex-col gap-0.5">
          Valeur min (kamas)
          <ChampNombre value={valeurMin} onChange={setValeurMin} vide placeholder="ex. 50k" className="w-24" />
        </label>
        <label className="flex flex-col gap-0.5">
          Jet
          <select value={jet} onChange={(e) => setJet(e.target.value as JetChoisi)} className="champ">
            <option value="max">max</option>
            <option value="moyen">moyen</option>
            <option value="min">min</option>
          </select>
        </label>
        <label className="flex items-center gap-1 pb-2">
          <input type="checkbox" checked={masquerDroppables} onChange={(e) => setMasquerDroppables(e.target.checked)} disabled={!meta?.droppableDisponible} />
          Masquer les droppables
        </label>
        <label className="flex items-center gap-1 pb-2">
          <input type="checkbox" checked={masquerSansPrix} onChange={(e) => setMasquerSansPrix(e.target.checked)} />
          Masquer si prix de rune manquant
        </label>
        <label className="flex items-center gap-1 pb-2">
          <input type="checkbox" checked={colDensite} onChange={(e) => setColDensite(e.target.checked)} />
          Colonne valeur ÷ niveau
        </label>
        <label className="flex items-center gap-1 pb-2" title="Objets liés au personnage ou de quête : le concasseur les refuse">
          <input type="checkbox" checked={inclureNonBrisables} onChange={(e) => setInclureNonBrisables(e.target.checked)} />
          Inclure les non brisables
        </label>
        <span className="tnum ml-auto pb-2">
          {formatNombre(lignes.total)} objets · coef. 100 % · brut
        </span>
      </div>

      <div className="carte overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-encre-2">
            <tr className="border-b border-bord">
              <En t="nom" label="Objet" right={false} />
              <En t="niveau" label="Niv." />
              <th className="px-2 py-1.5 text-left font-medium">Type</th>
              <En t="valeurNaturel" label="Naturel" title="Valeur espérée brute des runes, brisage naturel, coef. 100 %" />
              <th className="px-2 py-1.5 text-left font-medium">Meilleur focus</th>
              <En t="valeurMeilleure" label="Meilleure" title="Valeur espérée brute au meilleur focus" />
              {colDensite && <En t="densite" label="÷ niv." title="Valeur meilleure ÷ niveau" />}
              <th className="px-2 py-1.5 text-right font-medium" title="Dernier coefficient noté dans le journal">
                Coef noté
              </th>
              <th className="px-2 py-1.5 text-right font-medium" title="Prix HDV constaté, saisi à la main">
                Prix constaté
              </th>
              <En t="marge" label="Marge" title="Valeur meilleure nette de taxe − prix constaté" />
              <th className="px-2 py-1.5"></th>
            </tr>
          </thead>
          <tbody>
            {lignes.visibles.map((e) => {
              const it = e.item;
              const coef = dernierCoef(coefs[it.id]);
              const m = lignes.marge(e);
              return (
                <tr key={it.id} className="border-t border-bord">
                  <td className="px-2 py-1">
                    <span className="flex items-center gap-2">
                      <ItemImage src={it.imageLocale} alt="" fallback={placeholderPour(it.type, it.famille)} taille={24} />
                      <span className="truncate" title={it.nom}>
                        {it.nom}
                      </span>
                      {it.droppable === true && (
                        <span className="rounded bg-alerte-doux px-1 text-[10px] text-alerte" title="Droppable : les joueurs le brisent par flemme, coefficient souvent écrasé">
                          drop
                        </span>
                      )}
                      {e.prixManquants && (
                        <span className="text-alerte" title="Au moins une rune sans prix : valeur sous-estimée">
                          ⚠
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="tnum px-2 py-1 text-right">{it.niveau}</td>
                  <td className="px-2 py-1 text-xs text-encre-2">{it.type}</td>
                  <td className="tnum px-2 py-1 text-right">{formatKamas(e.valeurNaturel)}</td>
                  <td className="px-2 py-1 text-xs">{e.meilleurFocus ? STAT_BY_ID[e.meilleurFocus].label : <span className="text-encre-3">naturel</span>}</td>
                  <td className="tnum px-2 py-1 text-right font-medium">{formatKamas(e.valeurMeilleure)}</td>
                  {colDensite && <td className="tnum px-2 py-1 text-right text-encre-2">{formatNombre(e.valeurMeilleure / Math.max(1, it.niveau))}</td>}
                  <td className="tnum px-2 py-1 text-right text-encre-2">{coef ? formatPct(coef.coef, 0) : '—'}</td>
                  <td className="px-2 py-1 text-right">
                    <PrixConstate item={it} />
                  </td>
                  <td className={`tnum px-2 py-1 text-right ${m === null ? 'text-encre-3' : m > 0 ? 'text-ok' : 'text-ko'}`}>
                    {m === null ? '—' : formatKamas(m)}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button onClick={() => simuler(e)} className="text-xs lien">
                      simuler →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lignes.total > limite && (
          <div className="border-t border-bord p-2 text-center">
            <button onClick={() => setLimite((l) => l + PAGE)} className="text-xs lien">
              Afficher {Math.min(PAGE, lignes.total - limite)} de plus ({formatNombre(lignes.total - limite)} restants)
            </button>
          </div>
        )}
      </div>
      <p className="text-xs text-encre-2">
        Classement sur la valeur produite (le prix d'achat en HDV n'existe dans aucune API). Saisis un prix constaté pour voir la marge, puis « simuler » pour passer
        l'objet, son prix et son meilleur focus dans le simulateur.
      </p>
    </div>
  );
}
