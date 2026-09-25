import { STAT_BY_ID, placeholderPour } from '../data/statMapping.ts';
import { prixAchatMax } from '../engine/index.ts';
import { useDetailLignes, type Simulation } from '../hooks/useSimulation.ts';
import { formatKamas, formatNombre, formatPct } from '../lib/format.ts';
import { useReglages } from '../store/reglages.ts';
import { useNotes } from '../store/notes.ts';
import { useStorePrix } from '../store/prix.ts';
import { useSimu, type JetMode } from '../store/simu.ts';
import { ChampNombre } from './ChampNombre.tsx';
import { ItemImage } from './ItemImage.tsx';
import { RuneImage } from './RuneImage.tsx';

const MODES: { id: JetMode; titre: string }[] = [
  { id: 'min', titre: 'Jet minimum' },
  { id: 'moyen', titre: 'Jet moyen' },
  { id: 'max', titre: 'Jet maximum' },
];

/** Petit rond de sélection du jet, comme sur une fiche d'objet. */
function RondJet({ mode, actif, onClick }: { mode: (typeof MODES)[number]; actif: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="radio"
      aria-checked={actif}
      title={mode.titre}
      aria-label={mode.titre}
      className={`h-3.5 w-3.5 rounded-full border transition-colors ${actif ? 'border-accent bg-accent' : 'border-bord-fort bg-transparent hover:border-accent'}`}
    />
  );
}

/**
 * Carte d'un objet : coûts d'acquisition à gauche, résultat au centre,
 * coefficient à droite, puis le détail ligne par ligne avec et sans focus.
 */
export function CarteObjet({ sim }: { sim: Simulation }) {
  const { item, bilan, seuil } = sim;
  const lignes = useDetailLignes(sim);
  const { jetMode, setJetMode, setJet, setFocus, focus, setChamp, coefficient } = useSimu();
  const { prixConstates, coutsCraft, setPrixConstate, setCoutCraft } = useNotes();
  const setPrixRune = useStorePrix((s) => s.setPrix);
  const roiVise = useReglages((s) => s.roiVise);

  const v = bilan[bilan.retenu];
  const prixHdv = prixConstates[item.id]?.prix ?? null;
  const coutCraft = coutsCraft[item.id]?.prix ?? null;
  const totalSansFocus = lignes.reduce((s, l) => s + l.sansFocus.kamas, 0);
  const meilleureLigne = lignes.reduce<(typeof lignes)[number] | null>((m, l) => (!m || l.avecFocus.kamas > m.avecFocus.kamas ? l : m), null);

  return (
    <section className="carte overflow-hidden">
      {/* En-tête : objet, niveau, stratégie */}
      <div className="flex flex-wrap items-center gap-3 border-b border-bord px-4 py-3">
        <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={44} />
        <span className="min-w-0">
          <h2 className="truncate text-xl font-bold">{item.nom}</h2>
          <span className="tnum text-xs text-encre-2">
            Niveau {item.niveau} · {item.type}
            {item.droppable === true && <span className="badge ml-2 bg-alerte-doux text-alerte">droppable</span>}
            {item.nonBrisable && <span className="badge ml-2 bg-ko-doux text-ko">non brisable</span>}
          </span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          {focus !== null && (
            <button onClick={() => setFocus(null)} className="btn btn-petit">
              retirer le focus
            </button>
          )}
          <span className="rounded-lg border border-accent px-3 py-1.5 text-sm font-semibold text-accent">
            {focus === null ? 'Brisage naturel' : `Focus ${STAT_BY_ID[focus].label}`}
          </span>
        </span>
      </div>

      {/* Trois zones : coûts · résultat · coefficient */}
      <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="space-y-1.5 rounded-xl border border-bord bg-surface-2/60 p-3 text-sm">
          <label className="flex items-center justify-between gap-2">
            <span className="text-encre-2">Prix HDV</span>
            <ChampNombre value={prixHdv} onChange={(x) => setPrixConstate(item.id, x)} vide placeholder="—" className="w-28" aria-label="Prix HDV" />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-encre-2">Prix de craft</span>
            <ChampNombre
              value={coutCraft}
              onChange={(x) => setCoutCraft(item.id, x)}
              vide
              placeholder={item.recetteConnue ? '—' : 'pas de recette'}
              disabled={!item.recetteConnue}
              className="w-28"
              aria-label="Prix de craft"
            />
          </label>
          <label className="flex items-center justify-between gap-2 border-t border-bord pt-1.5">
            <span className="text-encre-2">Prix de revient retenu</span>
            <ChampNombre value={sim.options.prixRevient} onChange={(x) => setChamp('prixRevient', Math.max(0, x ?? 0))} className="w-28" aria-label="Prix de revient" />
          </label>
          <span className="flex flex-wrap gap-1 pt-1">
            {prixHdv !== null && (
              <button onClick={() => setChamp('prixRevient', prixHdv)} className="btn btn-petit">
                utiliser HDV
              </button>
            )}
            {coutCraft !== null && (
              <button onClick={() => setChamp('prixRevient', coutCraft)} className="btn btn-petit">
                utiliser craft
              </button>
            )}
          </span>
        </div>

        <div className="flex flex-col items-center justify-center gap-2">
          <div
            className={`w-full rounded-xl border px-4 py-3 text-center ${
              v.benefice > 0 ? 'border-ok/40 bg-ok-doux' : v.benefice < 0 ? 'border-ko/40 bg-ko-doux' : 'border-bord bg-surface-2/60'
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-encre-2">Achat → Brisage</div>
            <div className={`tnum text-3xl font-black ${v.benefice > 0 ? 'text-ok' : v.benefice < 0 ? 'text-ko' : ''}`}>
              {v.benefice > 0 ? '+' : ''}
              {formatKamas(v.benefice)}
            </div>
            <div className="tnum text-xs text-encre-2">
              {formatKamas(v.valeurNette)} de runes − {formatKamas(bilan.coutTotal)} d'achat
              {bilan.nbObjets > 1 && ` · lot de ${bilan.nbObjets}`}
            </div>
          </div>
          <div className="tnum flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-encre-2">
            <span title="Prix à ne pas dépasser pour rentrer dans ses frais">
              Achat max <strong className="text-encre">{formatKamas(prixAchatMax(v.valeurNette / Math.max(1, bilan.nbObjets)))}</strong>
            </span>
            <span title={`Prix à ne pas dépasser pour garder ${formatPct(roiVise, 0)} de marge`}>
              marge {formatPct(roiVise, 0)} : <strong className="text-encre">{formatKamas(prixAchatMax(v.valeurNette / Math.max(1, bilan.nbObjets), roiVise))}</strong>
            </span>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-bord bg-surface-2/60 p-3">
          <span className="titre-section">Coefficient</span>
          <span className="flex items-baseline gap-1">
            <ChampNombre
              value={coefficient}
              onChange={(x) => setChamp('coefficient', Math.max(1, x ?? 100))}
              decimales={1}
              className="w-24 [&>input]:h-11 [&>input]:text-2xl [&>input]:font-bold"
              aria-label="Coefficient"
            />
            <span className="text-xl font-bold text-encre-2">%</span>
          </span>
          <span className={`text-sm font-semibold ${v.roi !== null && v.roi > 0 ? 'text-accent' : 'text-encre-2'}`}>
            {v.roi === null ? 'Rentabilité : indique un prix' : `Rentabilité à ${formatPct(v.roi)}`}
          </span>
          <span className="tnum text-xs text-encre-2" title="Coefficient minimal pour ne pas briser à perte">
            seuil {seuil === null ? '—' : seuil <= 1 ? '≤ 1 %' : formatPct(seuil, 0)}
          </span>
        </div>
      </div>

      {/* Détail des lignes : sans focus / avec focus */}
      <div className="overflow-x-auto border-t border-bord">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-encre-2">
              <th className="px-3 py-2 text-left font-medium">Caractéristique</th>
              <th className="px-3 py-2 text-center font-medium">
                <span className="flex items-center justify-center gap-2">
                  Jet
                  <span role="radiogroup" aria-label="Jet global" className="flex items-center gap-1">
                    {MODES.map((m) => (
                      <RondJet key={m.id} mode={m} actif={jetMode === m.id} onClick={() => setJetMode(m.id)} />
                    ))}
                  </span>
                </span>
              </th>
              <th className="px-3 py-2 text-left font-medium">Rune</th>
              <th className="px-3 py-2 text-right font-medium">Prix</th>
              <th className="border-l border-bord px-3 py-2 text-right font-medium" colSpan={2}>
                Sans focus
              </th>
              <th className="border-l border-bord bg-accent-doux/40 px-3 py-2 text-right font-medium" colSpan={2}>
                Avec focus
              </th>
            </tr>
            <tr className="text-[11px] text-encre-3">
              <th colSpan={4}></th>
              <th className="border-l border-bord px-3 pb-1 text-right font-normal">Runes</th>
              <th className="px-3 pb-1 text-right font-normal">Kamas</th>
              <th className="border-l border-bord bg-accent-doux/40 px-3 pb-1 text-right font-normal">Runes</th>
              <th className="bg-accent-doux/40 px-3 pb-1 text-right font-normal">Kamas</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => {
              const malus = l.max <= 0;
              const estFocus = focus === l.statId;
              const meilleur = meilleureLigne?.statId === l.statId && !malus;
              return (
                <tr
                  key={`${l.statId}-${i}`}
                  className={`border-t border-bord ${malus ? 'text-encre-3' : ''} ${estFocus ? 'bg-accent-doux/60' : ''}`}
                >
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => !malus && setFocus(estFocus ? null : l.statId)}
                      disabled={malus}
                      className="text-left hover:text-accent disabled:hover:text-inherit"
                      title={malus ? 'Un malus ne rend rien' : estFocus ? 'Retirer le focus' : 'Focaliser sur cette ligne'}
                    >
                      {STAT_BY_ID[l.statId].label}
                      {malus && <span className="ml-1 text-xs">(malus)</span>}
                    </button>
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="tnum flex items-center justify-center gap-1 text-xs text-encre-2">
                      {formatNombre(l.min)}
                      <span>–</span>
                      <ChampNombre value={l.jet} onChange={(x) => setJet(i, x ?? 0)} className="w-16" aria-label={`Jet ${STAT_BY_ID[l.statId].label}`} />
                      <span>+</span>
                      {formatNombre(l.max)}
                    </span>
                  </td>
                  <td className="px-3 py-1.5">
                    {l.rune ? (
                      <span className="flex items-center gap-1.5">
                        <RuneImage rune={l.rune} taille={20} />
                        <span className="text-xs">{STAT_BY_ID[l.statId].abbr}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-encre-3">—</span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {l.rune ? (
                      <ChampNombre
                        value={l.prixRune ?? null}
                        onChange={(x) => setPrixRune(l.rune!.id, x)}
                        vide
                        placeholder="—"
                        className="w-24"
                        aria-label={`Prix ${l.rune.nom}`}
                      />
                    ) : null}
                  </td>
                  <td className="tnum border-l border-bord px-3 py-1.5 text-right">{formatNombre(l.sansFocus.runes, 2)}</td>
                  <td className="tnum px-3 py-1.5 text-right">{formatKamas(l.sansFocus.kamas)}</td>
                  <td className="tnum border-l border-bord bg-accent-doux/40 px-3 py-1.5 text-right">{formatNombre(l.avecFocus.runes, 2)}</td>
                  <td className={`tnum bg-accent-doux/40 px-3 py-1.5 text-right ${meilleur ? 'font-bold text-accent' : ''}`}>
                    {formatKamas(l.avecFocus.kamas)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-bord-fort text-sm font-semibold">
              <td className="px-3 py-2 text-encre-2" colSpan={4}>
                Total
              </td>
              <td className="border-l border-bord px-3 py-2"></td>
              <td className="tnum px-3 py-2 text-right">{formatKamas(totalSansFocus)}</td>
              <td className="border-l border-bord bg-accent-doux/40 px-3 py-2"></td>
              <td className="tnum bg-accent-doux/40 px-3 py-2 text-right text-accent">
                {meilleureLigne ? formatKamas(meilleureLigne.avecFocus.kamas) : '—'}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-4 pb-3 pt-2 text-xs text-encre-2">
        Clique une caractéristique pour focaliser dessus : les autres lignes sont détruites et ne reversent que la moitié de leur poids. La meilleure colonne
        « Avec focus » est mise en avant. Les décimales de runes sont des probabilités, pas des runes garanties.
      </p>
    </section>
  );
}
