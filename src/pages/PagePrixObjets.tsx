import { useMemo, useState } from 'react';
import { placeholderPour } from '../data/statMapping.ts';
import type { Item } from '../data/types.ts';
import { evaluerItem } from '../engine/index.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import type { Onglet } from '../components/EnTete.tsx';
import { ItemImage } from '../components/ItemImage.tsx';
import { Sauvegarde } from '../components/Sauvegarde.tsx';
import { useContexte } from '../hooks/useSimulation.ts';
import { formatDate, formatKamas, formatNombre, formatPct, joursDepuis } from '../lib/format.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { coutRetenu, useNotes } from '../store/notes.ts';
import { JOURS_PERIME } from '../store/prix.ts';
import { useReglages } from '../store/reglages.ts';
import { useSimu } from '../store/simu.ts';

const PAGE = 40;
type Tri = 'marge' | 'valeur' | 'niveau' | 'nom';

/** Prix des équipements : ce que tu relèves en HDV ou au craft, face à ce que l'objet rend en runes. */
export function PagePrixObjets({ aller }: { aller: (o: Onglet) => void }) {
  const items = useCatalogue((s) => s.items);
  const index = useCatalogue((s) => s.index);
  const ctx = useContexte();
  const { prixConstates, coutsCraft, setPrixConstate, setCoutCraft } = useNotes();
  const { coefSuppose, setCoefSuppose, serveur } = useReglages();
  const taxePct = useSimu((s) => s.taxePct);
  const choisirObjet = useSimu((s) => s.choisirObjet);
  const setChamp = useSimu((s) => s.setChamp);

  const [recherche, setRecherche] = useState('');
  const [type, setType] = useState('');
  const [seulementNotes, setSeulementNotes] = useState(true);
  const [tri, setTri] = useState<Tri>('marge');
  const [desc, setDesc] = useState(true);
  const [limite, setLimite] = useState(PAGE);

  const lignes = useMemo(() => {
    const base = index && (recherche.trim() !== '' || type)
      ? index.rechercher(recherche, { type: type || null, niveauMin: null, niveauMax: null }, 400)
      : items;
    const facteurNet = 1 - taxePct / 100;
    const out = base
      .filter((it) => !it.nonBrisable && it.stats.length > 0)
      .map((it) => {
        const cout = coutRetenu(prixConstates[it.id], coutsCraft[it.id]);
        const valeur = evaluerItem(it, ctx, 'moyen', coefSuppose).valeurMeilleure * facteurNet;
        return { item: it, cout, valeur, marge: cout ? valeur - cout.prix : null };
      })
      .filter((l) => !seulementNotes || l.cout !== null);
    const cle = (l: (typeof out)[number]): number | string => {
      switch (tri) {
        case 'valeur':
          return l.valeur;
        case 'niveau':
          return l.item.niveau;
        case 'nom':
          return l.item.nom;
        default:
          return l.marge ?? -Infinity;
      }
    };
    return out.sort((a, b) => {
      const ka = cle(a);
      const kb = cle(b);
      const c = typeof ka === 'string' ? ka.localeCompare(kb as string, 'fr') : ka - (kb as number);
      return (desc ? -c : c) || a.item.nom.localeCompare(b.item.nom, 'fr');
    });
  }, [items, index, recherche, type, seulementNotes, prixConstates, coutsCraft, ctx, coefSuppose, taxePct, tri, desc]);

  const nbNotes = new Set([...Object.keys(prixConstates), ...Object.keys(coutsCraft)]).size;

  const trierPar = (t: Tri) => {
    if (tri === t) setDesc((d) => !d);
    else {
      setTri(t);
      setDesc(t !== 'nom');
    }
  };
  const En = ({ t, label, right = true }: { t: Tri; label: string; right?: boolean }) => (
    <th className={`px-3 py-2 font-medium ${right ? 'text-right' : 'text-left'}`}>
      <button onClick={() => trierPar(t)} className="hover:underline">
        {label}
        {tri === t && <span className="ml-0.5">{desc ? '▼' : '▲'}</span>}
      </button>
    </th>
  );

  const ouvrir = (item: Item, prix: number | null) => {
    choisirObjet(item);
    setChamp('coefficient', coefSuppose);
    if (prix !== null) setChamp('prixRevient', prix);
    aller('objet');
  };

  return (
    <div className="space-y-4">
      <section className="carte p-4">
        <div className="flex flex-wrap items-end gap-x-3 gap-y-2 text-xs text-encre-2">
          <label className="flex flex-col gap-0.5">
            Rechercher un objet
            <input
              type="search"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="nom de l'objet…"
              className="champ h-9 w-64"
            />
          </label>
          <label className="flex flex-col gap-0.5">
            Type
            <select value={type} onChange={(e) => setType(e.target.value)} className="champ h-9">
              <option value="">tous</option>
              <option value="Arme">toutes armes</option>
              {index?.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5" title="Coefficient supposé au concasseur, pour estimer la valeur des runes">
            Coefficient
            <ChampNombre value={coefSuppose} onChange={(v) => setCoefSuppose(v ?? 100)} suffixe="%" className="w-20" />
          </label>
          <label className="flex items-center gap-1 pb-2">
            <input type="checkbox" checked={seulementNotes} onChange={(e) => setSeulementNotes(e.target.checked)} />
            Seulement mes prix notés
          </label>
          <span className="tnum ml-auto pb-2">
            {formatNombre(nbNotes)} objet(s) chiffré(s) · {serveur}
          </span>
        </div>
      </section>

      <section className="carte overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-encre-2">
            <tr className="border-b border-bord">
              <En t="nom" label="Objet" right={false} />
              <En t="niveau" label="Niv." />
              <En t="valeur" label="Runes nettes" />
              <th className="px-3 py-2 text-right font-medium">Prix HDV</th>
              <th className="px-3 py-2 text-right font-medium">Prix craft</th>
              <En t="marge" label="Marge" />
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {lignes.slice(0, limite).map((l) => {
              const perime = l.cout !== null && joursDepuis(l.cout.date) > JOURS_PERIME;
              return (
                <tr key={l.item.id} className="border-t border-bord">
                  <td className="px-3 py-1.5">
                    <span className="flex items-center gap-2">
                      <ItemImage src={l.item.imageLocale} alt="" fallback={placeholderPour(l.item.type, l.item.famille)} taille={24} />
                      <span className="min-w-0">
                        <span className="block truncate">{l.item.nom}</span>
                        <span className="block text-[11px] text-encre-2">
                          {l.item.type}
                          {l.cout && (
                            <span className={perime ? 'text-alerte' : ''}>
                              {' · '}
                              {perime ? '⚠ ' : ''}
                              {l.cout.source === 'craft' ? 'craft' : 'HDV'} · {formatDate(l.cout.date)}
                            </span>
                          )}
                        </span>
                      </span>
                    </span>
                  </td>
                  <td className="tnum px-3 py-1.5 text-right">{l.item.niveau}</td>
                  <td className="tnum px-3 py-1.5 text-right" title={`Valeur des runes au meilleur focus, coef. ${formatPct(coefSuppose, 0)}, taxe déduite`}>
                    {formatKamas(l.valeur)}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <ChampNombre
                      value={prixConstates[l.item.id]?.prix ?? null}
                      onChange={(v) => setPrixConstate(l.item.id, v)}
                      vide
                      placeholder="—"
                      className={`w-28 ${l.cout?.source === 'hdv' ? '[&>input]:border-accent' : ''}`}
                      aria-label={`Prix HDV ${l.item.nom}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <ChampNombre
                      value={coutsCraft[l.item.id]?.prix ?? null}
                      onChange={(v) => setCoutCraft(l.item.id, v)}
                      vide
                      placeholder={l.item.recetteConnue ? '—' : '·'}
                      disabled={!l.item.recetteConnue}
                      className={`w-28 ${l.cout?.source === 'craft' ? '[&>input]:border-accent' : ''}`}
                      aria-label={`Prix de craft ${l.item.nom}`}
                    />
                  </td>
                  <td className={`tnum px-3 py-1.5 text-right font-medium ${l.marge === null ? 'text-encre-3' : l.marge > 0 ? 'text-ok' : 'text-ko'}`}>
                    {l.marge === null ? '—' : `${l.marge > 0 ? '+' : ''}${formatKamas(l.marge)}`}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    <button onClick={() => ouvrir(l.item, l.cout?.prix ?? null)} className="lien text-xs">
                      briser →
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {lignes.length === 0 && (
          <p className="p-4 text-sm text-encre-2">
            {seulementNotes ? 'Aucun prix noté pour le moment : décoche le filtre et cherche un objet pour renseigner son prix.' : 'Aucun objet ne correspond.'}
          </p>
        )}
        {lignes.length > limite && (
          <div className="border-t border-bord p-2 text-center">
            <button onClick={() => setLimite((l) => l + PAGE)} className="lien text-xs">
              Afficher {Math.min(PAGE, lignes.length - limite)} de plus ({formatNombre(lignes.length - limite)} restants)
            </button>
          </div>
        )}
      </section>

      <section className="carte p-4">
        <Sauvegarde />
      </section>
    </div>
  );
}
