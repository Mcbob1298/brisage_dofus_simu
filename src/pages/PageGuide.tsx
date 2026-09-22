import { useState } from 'react';
import { STAT_BY_ID, placeholderPour } from '../data/statMapping.ts';
import type { Item } from '../data/types.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import { Courbe } from '../components/Courbe.tsx';
import type { Onglet } from '../components/EnTete.tsx';
import { ItemImage } from '../components/ItemImage.tsx';
import { RechercheObjet } from '../components/RechercheObjet.tsx';
import { strategieRetenue, useCandidatsEvalues, useSuggestions, type CandidatEvalue, type EtatCandidat, type Suggestion } from '../hooks/useGuide.ts';
import { formatDate, formatKamas, formatNombre, formatPct, joursDepuis } from '../lib/format.ts';
import { JOURS_PERIME } from '../store/prix.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { useGuide, type JetGuide } from '../store/guide.ts';
import { useNotes } from '../store/notes.ts';
import { useSimu } from '../store/simu.ts';

const TRANCHES = [60, 120, 160, 200];

function Etape({ n, titre, actif, children, aide }: { n: number; titre: string; actif: boolean; children: React.ReactNode; aide?: string }) {
  return (
    <section className={`rounded border bg-white p-3 dark:bg-zinc-900 ${actif ? 'border-zinc-200 dark:border-zinc-800' : 'border-zinc-100 opacity-50 dark:border-zinc-900'}`}>
      <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-900 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900">{n}</span>
        {titre}
        {aide && <span className="ml-1 text-xs font-normal text-zinc-500">{aide}</span>}
      </h2>
      {actif ? children : null}
    </section>
  );
}

const ETAT: Record<EtatCandidat, { label: string; cls: string }> = {
  manquePrix: { label: 'prix ?', cls: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400' },
  tropCher: { label: 'trop cher', cls: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
  aTester: { label: 'à tester', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  pret: { label: 'rentable', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  perte: { label: 'à perte', cls: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' },
  ecarte: { label: 'écarté', cls: 'bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800' },
};

function Objet({ item, taille = 24 }: { item: Item; taille?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={taille} />
      <span className="min-w-0">
        <span className="block truncate">{item.nom}</span>
        <span className="tnum block text-[11px] text-zinc-500">
          niv. {item.niveau} · {item.type}
        </span>
      </span>
    </span>
  );
}

/** Ligne d'un candidat : prix HDV et coef lu sont les deux saisies du « test ». */
function LigneCandidat({ e, ouvrir }: { e: CandidatEvalue; ouvrir: (item: Item) => void }) {
  const setPrixConstate = useNotes((s) => s.setPrixConstate);
  const ajouterCoef = useNotes((s) => s.ajouterCoef);
  const { retirerCandidat, setStatut } = useGuide();
  const [coefSaisi, setCoefSaisi] = useState<number | null>(null);
  const et = ETAT[e.etat];
  return (
    <tr className={`border-t border-zinc-100 dark:border-zinc-800 ${e.etat === 'ecarte' ? 'opacity-60' : ''}`}>
      <td className="px-2 py-1">
        <Objet item={e.item} />
      </td>
      <td className="tnum px-2 py-1 text-right text-zinc-500" title="Valeur espérée des runes à coef. 100 %, meilleur focus">
        {formatKamas(e.valeur100)}
      </td>
      <td className="px-2 py-1">
        <ChampNombre value={e.prix} onChange={(v) => setPrixConstate(e.item.id, v)} vide placeholder="prix HDV" className="w-24 [&>input]:h-7" aria-label={`Prix ${e.item.nom}`} />
        {e.prixDate && (
          <span
            className={`block text-[10px] ${joursDepuis(e.prixDate) > JOURS_PERIME ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-500'}`}
            title={joursDepuis(e.prixDate) > JOURS_PERIME ? `Prix vieux de ${joursDepuis(e.prixDate)} jours : à vérifier` : undefined}
          >
            {joursDepuis(e.prixDate) > JOURS_PERIME ? '⚠ ' : ''}noté le {formatDate(e.prixDate)}
          </span>
        )}
      </td>
      <td className="px-2 py-1">
        <span className="flex items-center gap-1">
          <ChampNombre
            value={coefSaisi}
            onChange={setCoefSaisi}
            vide
            suffixe="%"
            decimales={1}
            placeholder={e.coef === null ? 'coef lu' : formatNombre(e.coef, 1)}
            className="w-20 [&>input]:h-7"
            aria-label={`Coefficient ${e.item.nom}`}
          />
          <button
            onClick={() => {
              if (coefSaisi !== null && coefSaisi > 0) {
                ajouterCoef(e.item.id, coefSaisi);
                setCoefSaisi(null);
              }
            }}
            disabled={coefSaisi === null}
            className="rounded border border-zinc-300 px-1.5 text-xs disabled:opacity-40 dark:border-zinc-700"
            title="Enregistrer ce coefficient dans le journal"
          >
            noter
          </button>
        </span>
        {e.coefDate && <span className="block text-[10px] text-zinc-500">noté le {formatDate(e.coefDate)}</span>}
      </td>
      <td className="px-2 py-1 text-xs">{e.focus ? `Focus ${STAT_BY_ID[e.focus].label}` : 'Naturel'}</td>
      <td className={`tnum px-2 py-1 text-right ${e.coef === null ? 'text-zinc-400' : e.benefice > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
        {e.coef === null || e.prix === null ? '—' : formatKamas(e.benefice)}
        {e.roi !== null && e.prix !== null && <span className="block text-[10px] text-zinc-500">ROI {formatPct(e.roi)}</span>}
      </td>
      <td className="tnum px-2 py-1 text-right text-zinc-500" title="Coefficient minimum pour être rentable à ce prix">
        {e.seuil === null ? '—' : e.seuil <= 1 ? '≤ 1 %' : formatPct(e.seuil, 0)}
      </td>
      <td className="px-2 py-1">
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${et.cls}`}>{et.label}</span>
      </td>
      <td className="px-2 py-1 text-right whitespace-nowrap text-xs">
        <button onClick={() => ouvrir(e.item)} className="text-sky-600 hover:underline dark:text-sky-400">
          détail
        </button>
        {' · '}
        {e.etat === 'ecarte' ? (
          <button onClick={() => setStatut(e.item.id, 'aTester')} className="text-sky-600 hover:underline dark:text-sky-400">
            reprendre
          </button>
        ) : (
          <button onClick={() => setStatut(e.item.id, 'ecarte')} className="text-zinc-500 hover:underline">
            écarter
          </button>
        )}
        {' · '}
        <button onClick={() => retirerCandidat(e.item.id)} className="text-zinc-400 hover:text-red-600" aria-label="Retirer">
          ✕
        </button>
      </td>
    </tr>
  );
}

/** Une suggestion : prix HDV saisi ici → enregistré partout, et la liste se recompose. */
function LigneSuggestion({ s, onAjouter }: { s: Suggestion; onAjouter: () => void }) {
  const setPrixConstate = useNotes((st) => st.setPrixConstate);
  return (
    <li className="flex items-center gap-2 px-2 py-1 text-sm">
      <Objet item={s.eval.item} />
      <span className="tnum ml-auto text-right text-xs text-zinc-500" title="Valeur espérée des runes à coef. 100 % · valeur ÷ niveau">
        {formatKamas(s.eval.valeurMeilleure)}
        {s.beneficeEstime === null ? (
          <span className="block text-[10px]">{formatNombre(s.eval.valeurMeilleure / Math.max(20, s.eval.item.niveau))} / niv.</span>
        ) : (
          <span className={`block text-[10px] ${s.beneficeEstime > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`} title="Bénéfice estimé à coef. 100 %, net de taxe, avant test du coefficient">
            {s.beneficeEstime >= 0 ? '+' : ''}
            {formatKamas(s.beneficeEstime)} @100 %{s.roiEstime !== null ? ` · ROI ${formatPct(s.roiEstime)}` : ''}
          </span>
        )}
      </span>
      <ChampNombre
        value={s.prix}
        onChange={(v) => setPrixConstate(s.eval.item.id, v)}
        vide
        placeholder="prix HDV"
        className="w-24 [&>input]:h-7"
        aria-label={`Prix HDV ${s.eval.item.nom}`}
      />
      <button onClick={onAjouter} className="rounded border border-zinc-300 px-1.5 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800" aria-label={`Ajouter ${s.eval.item.nom}`} title="Ajouter aux objets à tester">
        +
      </button>
    </li>
  );
}

export function PageGuide({ aller }: { aller: (o: Onglet) => void }) {
  const g = useGuide();
  const parId = useCatalogue((s) => s.parId);
  const nbPrixRunes = useCatalogue((s) => s.runes.length);
  const evalues = useCandidatsEvalues();
  const suggestions = useSuggestions();
  const { choisirObjet, setChamp, setFocus } = useSimu();
  const [nbSession, setNbSession] = useState<number | null>(null);
  const [gainSession, setGainSession] = useState<number | null>(null);
  const [coefSession, setCoefSession] = useState<number | null>(null);
  const ajouterCoef = useNotes((s) => s.ajouterCoef);

  const objectifOk = g.kamasActuels !== null && g.objectif !== null && g.objectif > 0;
  const strategie = strategieRetenue(evalues, g.strategieItemId);
  const prets = evalues.filter((e) => e.etat === 'pret').sort((a, b) => (b.plan?.gainPremierCycle ?? 0) - (a.plan?.gainPremierCycle ?? 0));
  const [sessionItemId, setSessionItemId] = useState<number | null>(null);
  const itemSession = parId.get(sessionItemId ?? strategie?.item.id ?? -1);

  const ouvrir = (item: Item, e?: CandidatEvalue) => {
    choisirObjet(item);
    if (e?.prix !== null && e?.prix !== undefined) setChamp('prixRevient', e.prix);
    if (e?.coef) setChamp('coefficient', e.coef);
    if (e) setFocus(e.focus);
    aller('objet');
  };

  const enregistrerSession = () => {
    if (!itemSession || nbSession === null || gainSession === null) return;
    g.ajouterSession({ date: new Date().toISOString(), itemId: itemSession.id, nbObjets: nbSession, gain: gainSession });
    if (coefSession !== null && coefSession > 0) ajouterCoef(itemSession.id, coefSession);
    setNbSession(null);
    setGainSession(null);
    setCoefSession(null);
  };

  const progression = objectifOk ? Math.max(0, Math.min(1, (g.kamasActuels ?? 0) / g.objectif!)) : 0;
  const atteint = objectifOk && (g.kamasActuels ?? 0) >= g.objectif!;

  return (
    <div className="space-y-3">
      {/* 1. Objectif */}
      <Etape n={1} titre="Ton objectif" actif>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
            Kamas actuels
            <ChampNombre value={g.kamasActuels} onChange={g.setKamas} vide placeholder="ex. 2,5M" className="w-32" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
            Objectif
            <ChampNombre value={g.objectif} onChange={g.setObjectif} vide placeholder="ex. 10M" className="w-32" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-zinc-500" title="Jets supposés des objets que tu achètes : « moyen » est prudent pour de l'HDV, « max » si tu craftes">
            Jets des objets
            <select value={g.jet} onChange={(e) => g.setJet(e.target.value as JetGuide)} className="h-8 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
              <option value="moyen">moyens (prudent)</option>
              <option value="max">max (craft)</option>
              <option value="min">min</option>
            </select>
          </label>
          {objectifOk && (
            <div className="min-w-56 flex-1">
              <div className="mb-1 flex justify-between text-xs text-zinc-500">
                <span className="tnum">{formatKamas(g.kamasActuels!)}</span>
                <span className="tnum">
                  {atteint ? 'objectif atteint 🎉' : `reste ${formatKamas(g.objectif! - g.kamasActuels!)}`} · {formatKamas(g.objectif!)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                <div className="h-full bg-emerald-500 transition-all" style={{ width: `${progression * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </Etape>

      {/* 2. Candidats */}
      <Etape n={2} titre="Objets à tester" actif={objectifOk} aide="ajoute des objets, note leur prix HDV et le coefficient lu au concasseur">
        {nbPrixRunes === 0 && <p className="text-sm text-orange-600">Catalogue non chargé.</p>}
        {evalues.length > 0 && (
          <div className="mb-3 overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-zinc-500">
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-2 py-1.5 font-medium">Objet</th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Repère à coef. 100 %">
                    Runes @100 %
                  </th>
                  <th className="px-2 py-1.5 font-medium">Prix HDV</th>
                  <th className="px-2 py-1.5 font-medium">Coef lu</th>
                  <th className="px-2 py-1.5 font-medium">Stratégie</th>
                  <th className="px-2 py-1.5 text-right font-medium">Bénéfice / objet</th>
                  <th className="px-2 py-1.5 text-right font-medium">Seuil</th>
                  <th className="px-2 py-1.5 font-medium">État</th>
                  <th className="px-2 py-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {evalues.map((e) => (
                  <LigneCandidat key={e.item.id} e={e} ouvrir={(it) => ouvrir(it, e)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Suggestions (non droppables, runes toutes pricées)</h3>
            <div className="mb-1 flex flex-wrap items-center gap-1 text-xs">
              <span className="text-zinc-500">Niveau ≤</span>
              {TRANCHES.map((n) => (
                <button
                  key={n}
                  onClick={() => g.setNiveauMaxSuggestions(n)}
                  className={`rounded border px-1.5 py-0.5 ${suggestions.niveauMax === n ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400'}`}
                >
                  {n}
                </button>
              ))}
              {suggestions.auto ? (
                <span className="text-zinc-500" title="L'app ne connaît pas les prix HDV : le niveau est le seul repère de prix. Tranche pré-choisie d'après ta bourse, à ajuster.">
                  (indicatif d'après ta bourse)
                </span>
              ) : (
                <button onClick={() => g.setNiveauMaxSuggestions(null)} className="text-sky-600 hover:underline dark:text-sky-400">
                  auto
                </button>
              )}
              <span className="ml-auto text-zinc-500">tri</span>
              <select
                value={g.triSuggestions}
                onChange={(e) => g.setTriSuggestions(e.target.value as 'densite' | 'valeur')}
                className="h-6 rounded border border-zinc-300 bg-white px-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <option value="densite">valeur ÷ niveau</option>
                <option value="valeur">valeur brute</option>
              </select>
            </div>
            {suggestions.surMesure.length > 0 && (
              <>
                <div className="mb-1 mt-2 text-[11px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Sur mesure — dans ta bourse, prix notés</div>
                <ul className="mb-2 divide-y divide-emerald-100 rounded border border-emerald-200 bg-emerald-50/40 dark:divide-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30">
                  {suggestions.surMesure.map((s) => (
                    <LigneSuggestion key={s.eval.item.id} s={s} onAjouter={() => g.ajouterCandidat(s.eval.item.id)} />
                  ))}
                </ul>
              </>
            )}
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-zinc-500">À chiffrer — note le prix HDV, la liste se met à jour</div>
            <ul className="divide-y divide-zinc-100 rounded border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {suggestions.aChiffrer.map((s) => (
                <LigneSuggestion key={s.eval.item.id} s={s} onAjouter={() => g.ajouterCandidat(s.eval.item.id)} />
              ))}
              {suggestions.aChiffrer.length === 0 && <li className="px-2 py-1 text-xs text-zinc-500">Plus rien à chiffrer dans cette tranche.</li>}
            </ul>
            <p className="mt-1 text-xs text-zinc-500">
              Aucune API ne donne les prix HDV : un prix noté trop cher pour ta bourse retire l'objet des suggestions
              {suggestions.nbTropChers > 0 && <span className="tnum"> ({suggestions.nbTropChers} masqué{suggestions.nbTropChers > 1 ? 's' : ''} pour l'instant)</span>}, un prix
              abordable le fait remonter en « sur mesure ».
            </p>
            <button onClick={() => aller('explorateur')} className="mt-1 text-xs text-sky-600 hover:underline dark:text-sky-400">
              Voir tout l'explorateur →
            </button>
          </div>
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Ajouter un objet précis</h3>
            <RechercheObjet onChoisir={(it) => g.ajouterCandidat(it.id)} />
            <p className="mt-2 text-xs text-zinc-500">
              Le test : achète (ou crafte) un exemplaire, note son prix, ouvre le concasseur et note le coefficient affiché. Le bénéfice par objet et le seuil se
              calculent avec tes prix de runes. Tu ne notes que tes candidats (5 à 10 objets), jamais tout le catalogue ; un prix reste valable jusqu'à ce que tu le
              changes, et passe en orange au bout de {JOURS_PERIME} jours.
            </p>
          </div>
        </div>
      </Etape>

      {/* 3. Stratégie */}
      <Etape n={3} titre="Stratégie" actif={objectifOk && prets.length > 0} aide={prets.length === 0 ? 'apparaît dès qu’un objet testé est rentable' : undefined}>
        {strategie && strategie.plan && (
          <div className="space-y-2">
            <div className="rounded border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
              <div className="flex flex-wrap items-center gap-3">
                <Objet item={strategie.item} taille={40} />
                <div className="text-sm">
                  <strong>{strategie.focus ? `Focus ${STAT_BY_ID[strategie.focus].label}` : 'Brisage naturel'}</strong> à{' '}
                  <span className="tnum">{formatPct(strategie.coef!, 0)}</span> (seuil {strategie.seuil === null ? '—' : formatPct(strategie.seuil, 0)}) ·{' '}
                  <span className="tnum">{formatKamas(strategie.benefice)}</span> / objet · ROI <span className="tnum">{formatPct(strategie.roi ?? 0)}</span>
                </div>
              </div>
              <div className="tnum mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                <div>
                  <div className="text-[11px] uppercase text-zinc-500">Ce cycle</div>
                  <div className="font-semibold">{formatNombre(strategie.plan.objetsPremierCycle)} objets</div>
                  <div className="text-xs text-zinc-500">≈ {formatKamas(strategie.plan.objetsPremierCycle * (strategie.prix ?? 0))} investis</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-zinc-500">Gain du cycle</div>
                  <div className="font-semibold text-emerald-600 dark:text-emerald-400">+{formatKamas(strategie.plan.gainPremierCycle)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-zinc-500">Cycles jusqu'à l'objectif</div>
                  <div className="font-semibold">{strategie.plan.cycles === null ? 'hors de portée' : strategie.plan.cycles === 0 ? 'atteint' : strategie.plan.cycles}</div>
                  <div className="text-xs text-zinc-500">en réinvestissant tout</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-zinc-500">Objets au total</div>
                  <div className="font-semibold">{strategie.plan.cycles ? formatNombre(strategie.plan.objetsTotal) : '—'}</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                Le coefficient baisse à chaque brisage : re-note-le après chaque session (étape 4). Dès qu'il passe sous le seuil, bascule sur le suivant.
              </p>
            </div>
            {prets.length > 1 && (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-zinc-500">
                  <tr>
                    <th className="px-2 py-1 font-medium">Alternatives rentables</th>
                    <th className="px-2 py-1 text-right font-medium">Bénéfice / objet</th>
                    <th className="px-2 py-1 text-right font-medium">Gain / cycle</th>
                    <th className="px-2 py-1 text-right font-medium">Cycles</th>
                    <th className="px-2 py-1"></th>
                  </tr>
                </thead>
                <tbody>
                  {prets.map((e) => (
                    <tr key={e.item.id} className={`border-t border-zinc-100 dark:border-zinc-800 ${e === strategie ? 'font-medium' : ''}`}>
                      <td className="px-2 py-1">
                        {e === strategie && <span className="mr-1 text-emerald-600">★</span>}
                        {e.item.nom}
                      </td>
                      <td className="tnum px-2 py-1 text-right">{formatKamas(e.benefice)}</td>
                      <td className="tnum px-2 py-1 text-right">{e.plan ? `+${formatKamas(e.plan.gainPremierCycle)}` : '—'}</td>
                      <td className="tnum px-2 py-1 text-right">{e.plan?.cycles ?? '—'}</td>
                      <td className="px-2 py-1 text-right">
                        {e !== strategie && (
                          <button onClick={() => g.retenir(e.item.id)} className="text-xs text-sky-600 hover:underline dark:text-sky-400">
                            retenir
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Etape>

      {/* 4. Suivi */}
      <Etape n={4} titre="Suivi" actif={objectifOk && (strategie !== null || g.sessions.length > 0)}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Enregistrer une session</h3>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
                Objet
                <select
                  value={itemSession?.id ?? ''}
                  onChange={(e) => setSessionItemId(Number(e.target.value))}
                  className="h-8 max-w-48 rounded border border-zinc-300 bg-white px-2 text-sm text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                >
                  {evalues
                    .filter((e) => e.etat !== 'ecarte')
                    .map((e) => (
                      <option key={e.item.id} value={e.item.id}>
                        {e.item.nom}
                      </option>
                    ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
                Brisés
                <ChampNombre value={nbSession} onChange={setNbSession} vide className="w-16" />
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-zinc-500" title="Ventes de runes − achats d'objets, taxe déduite">
                Gain net (kamas)
                <ChampNombre value={gainSession} onChange={setGainSession} vide placeholder="ex. 450k" className="w-28" />
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-zinc-500">
                Coef en fin de session
                <ChampNombre value={coefSession} onChange={setCoefSession} vide suffixe="%" decimales={1} className="w-24" />
              </label>
              <button
                onClick={enregistrerSession}
                disabled={!itemSession || nbSession === null || gainSession === null}
                className="h-8 rounded bg-zinc-900 px-3 text-sm text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Enregistrer
              </button>
            </div>
            <p className="mt-1 text-xs text-zinc-500">Le gain s'ajoute à tes kamas actuels ; le coef noté met à jour la stratégie.</p>
            {g.sessions.length > 0 && (
              <ul className="mt-2 max-h-48 divide-y divide-zinc-100 overflow-y-auto text-xs dark:divide-zinc-800">
                {[...g.sessions].reverse().map((s) => (
                  <li key={s.id} className="flex items-center gap-2 py-1">
                    <span className="tnum w-20 text-zinc-500">{formatDate(s.date)}</span>
                    <span className="truncate">{parId.get(s.itemId)?.nom ?? `#${s.itemId}`}</span>
                    <span className="tnum text-zinc-500">× {s.nbObjets}</span>
                    <span className={`tnum ml-auto font-medium ${s.gain >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      {s.gain >= 0 ? '+' : ''}
                      {formatKamas(s.gain)}
                    </span>
                    <button onClick={() => g.supprimerSession(s.id)} className="text-zinc-400 hover:text-red-600" aria-label="Supprimer la session">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Progression</h3>
            {g.historiqueKamas.length >= 2 ? (
              <Courbe
                points={g.historiqueKamas.map((p) => ({ date: p.date, valeur: p.kamas }))}
                formatY={formatKamas}
                reference={g.objectif !== null ? { valeur: g.objectif, label: 'objectif' } : undefined}
                ariaLabel="Évolution des kamas"
              />
            ) : (
              <p className="text-xs text-zinc-500">La courbe apparaît après ta première session.</p>
            )}
            {g.sessions.length > 0 && (
              <p className="tnum mt-1 text-xs text-zinc-500">
                {g.sessions.length} session(s) · {formatNombre(g.sessions.reduce((n, s) => n + s.nbObjets, 0))} objets brisés ·{' '}
                {formatKamas(g.sessions.reduce((n, s) => n + s.gain, 0))} gagnés
              </p>
            )}
          </div>
        </div>
      </Etape>

      <div className="text-right">
        <button
          onClick={() => {
            if (confirm('Réinitialiser le guide (objectif, candidats, sessions) ? Les prix et coefficients notés sont conservés.')) g.reinitialiser();
          }}
          className="text-xs text-zinc-400 hover:text-red-600"
        >
          Réinitialiser le guide
        </button>
      </div>
    </div>
  );
}
