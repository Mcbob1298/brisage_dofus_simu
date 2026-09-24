import { useState } from 'react';
import { STAT_BY_ID, placeholderPour } from '../data/statMapping.ts';
import type { Item } from '../data/types.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import { Courbe } from '../components/Courbe.tsx';
import type { Onglet } from '../components/EnTete.tsx';
import { ItemImage } from '../components/ItemImage.tsx';
import { RechercheObjet } from '../components/RechercheObjet.tsx';
import { useEstimation } from '../hooks/useEstimation.ts';
import { strategieRetenue, useCandidatsEvalues, useKamasParPoint, useSuggestions, type CandidatEvalue, type EtatCandidat, type Suggestion } from '../hooks/useGuide.ts';
import { formatDate, formatKamas, formatNombre, formatPct, joursDepuis } from '../lib/format.ts';
import { JOURS_PERIME } from '../store/prix.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { budgetTest, PARTS_BUDGET_TEST, useGuide, type JetGuide } from '../store/guide.ts';
import { useNotes } from '../store/notes.ts';
import { useSimu } from '../store/simu.ts';
import { SectionFarm } from './SectionFarm.tsx';

const TRANCHES = [60, 120, 160, 200];

function Etape({ n, titre, actif, children, aide }: { n: number; titre: string; actif: boolean; children: React.ReactNode; aide?: string }) {
  return (
    <section className={`carte p-4 transition-opacity ${actif ? '' : 'opacity-50'}`}>
      <h2 className="mb-3 flex items-center gap-2.5 text-base font-semibold">
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${actif ? 'bg-accent text-white' : 'bg-fond-2 text-encre-2'}`}>{n}</span>
        {titre}
        {aide && <span className="ml-1 text-xs font-normal text-encre-2">{aide}</span>}
      </h2>
      {actif ? children : null}
    </section>
  );
}

const ETAT: Record<EtatCandidat, { label: string; cls: string }> = {
  nonBrisable: { label: 'non brisable', cls: 'bg-ko-doux text-ko' },
  manquePrix: { label: 'prix ?', cls: 'bg-surface-2 text-encre-2' },
  tropCher: { label: 'dépasse le budget de test', cls: 'bg-alerte-doux text-alerte' },
  aTester: { label: 'à tester', cls: 'bg-info-doux text-info' },
  pret: { label: 'rentable', cls: 'bg-ok-doux text-ok' },
  perte: { label: 'à perte', cls: 'bg-ko-doux text-ko' },
  ecarte: { label: 'écarté', cls: 'bg-surface-2 text-encre-3 line-through' },
};

function Objet({ item, taille = 24 }: { item: Item; taille?: number }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={taille} />
      <span className="min-w-0">
        <span className="block truncate">{item.nom}</span>
        <span className="tnum block text-[11px] text-encre-2">
          niv. {item.niveau} · {item.type}
        </span>
      </span>
    </span>
  );
}

/** Ligne d'un candidat : prix HDV et coef lu sont les deux saisies du « test ». */
function LigneCandidat({ e, ouvrir }: { e: CandidatEvalue; ouvrir: (item: Item) => void }) {
  const setPrixConstate = useNotes((s) => s.setPrixConstate);
  const setCoutCraft = useNotes((s) => s.setCoutCraft);
  const ajouterCoef = useNotes((s) => s.ajouterCoef);
  const { retirerCandidat, setStatut } = useGuide();
  const [coefSaisi, setCoefSaisi] = useState<number | null>(null);
  const et = ETAT[e.etat];
  return (
    <tr className={`border-t border-bord ${e.etat === 'ecarte' ? 'opacity-60' : ''}`}>
      <td className="px-2 py-1">
        <Objet item={e.item} />
      </td>
      <td className="tnum px-2 py-1 text-right text-encre-2" title="Valeur espérée des runes à coef. 100 %, meilleur focus">
        {formatKamas(e.valeur100)}
      </td>
      <td className="px-2 py-1">
        <span className="flex items-center gap-1">
          <ChampNombre value={e.prixHdv} onChange={(v) => setPrixConstate(e.item.id, v)} vide placeholder="HDV" className={`w-20 [&>input]:h-7 ${e.source === 'hdv' ? '[&>input]:border-accent' : ''}`} aria-label={`Prix HDV ${e.item.nom}`} />
          <ChampNombre
            value={e.coutCraft}
            onChange={(v) => setCoutCraft(e.item.id, v)}
            vide
            placeholder={e.item.recetteConnue ? 'craft' : '—'}
            disabled={!e.item.recetteConnue}
            className={`w-20 [&>input]:h-7 ${e.source === 'craft' ? '[&>input]:border-accent' : ''}`}
            aria-label={`Coût de craft ${e.item.nom}`}
            title={e.item.recetteConnue ? 'Coût total du craft (ressources)' : 'Pas de recette connue'}
          />
        </span>
        {e.prixDate && (
          <span
            className={`block text-[10px] ${joursDepuis(e.prixDate) > JOURS_PERIME ? 'text-alerte' : 'text-encre-2'}`}
            title={joursDepuis(e.prixDate) > JOURS_PERIME ? `Prix vieux de ${joursDepuis(e.prixDate)} jours : à vérifier` : undefined}
          >
            {joursDepuis(e.prixDate) > JOURS_PERIME ? '⚠ ' : ''}{e.source === 'craft' ? 'craft' : 'HDV'} retenu · {formatDate(e.prixDate)}
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
            className="btn btn-petit px-1.5"
            title="Enregistrer ce coefficient dans le journal"
          >
            noter
          </button>
        </span>
        {e.coefDate && <span className="block text-[10px] text-encre-2">noté le {formatDate(e.coefDate)}</span>}
      </td>
      <td className="px-2 py-1 text-xs">{e.focus ? `Focus ${STAT_BY_ID[e.focus].label}` : 'Naturel'}</td>
      <td className={`tnum px-2 py-1 text-right ${e.coef === null ? 'text-encre-3' : e.benefice > 0 ? 'text-ok' : 'text-ko'}`}>
        {e.coef === null || e.prix === null ? '—' : formatKamas(e.benefice)}
        {e.roi !== null && e.prix !== null && <span className="block text-[10px] text-encre-2">ROI {formatPct(e.roi)}</span>}
      </td>
      <td className="tnum px-2 py-1 text-right text-encre-2" title="Coefficient minimum pour être rentable à ce prix">
        {e.seuil === null ? '—' : e.seuil <= 1 ? '≤ 1 %' : formatPct(e.seuil, 0)}
      </td>
      <td className="px-2 py-1">
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${et.cls}`}>{et.label}</span>
      </td>
      <td className="px-2 py-1 text-right whitespace-nowrap text-xs">
        <button onClick={() => ouvrir(e.item)} className="lien">
          détail
        </button>
        {' · '}
        {e.etat === 'ecarte' ? (
          <button onClick={() => setStatut(e.item.id, 'aTester')} className="lien">
            reprendre
          </button>
        ) : (
          <button onClick={() => setStatut(e.item.id, 'ecarte')} className="text-encre-2 hover:underline">
            écarter
          </button>
        )}
        {' · '}
        <button onClick={() => retirerCandidat(e.item.id)} className="text-encre-3 hover:text-ko" aria-label="Retirer">
          ✕
        </button>
      </td>
    </tr>
  );
}

/** Une suggestion : prix max d'achat, lignes à reconnaître en HDV, prix saisi ici → enregistré partout. */
function LigneSuggestion({ s, onAjouter }: { s: Suggestion; onAjouter: () => void }) {
  const setPrixConstate = useNotes((st) => st.setPrixConstate);
  const setCoutCraft = useNotes((st) => st.setCoutCraft);
  const estimateur = useEstimation();
  const item = s.eval.item;
  const estimation = s.prixHdv === null && s.coutCraft === null ? estimateur.estimer(item) : null;
  return (
    <li className="flex items-center gap-2 px-2 py-1.5 text-sm">
      <span className="flex min-w-0 flex-1 items-start gap-2">
        <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={28} className="mt-0.5" />
        <span className="min-w-0">
          <span className="block truncate leading-tight">
            {item.nom} <span className="tnum text-[11px] text-encre-2">· niv. {item.niveau} · {item.type}</span>
          </span>
          <span className="mt-0.5 flex flex-wrap gap-1 text-[10px] text-encre-2">
            {s.lignes.slice(0, 4).map((l) => (
              <span key={l.statId} className="rounded bg-surface-2 px-1" title={`≈ ${formatKamas(l.valeur)} de runes`}>
                {formatNombre(l.jet)} {STAT_BY_ID[l.statId].label}
              </span>
            ))}
            {s.lignes.length > 4 && <span>+{s.lignes.length - 4}</span>}
          </span>
        </span>
      </span>
      <span className="tnum shrink-0 text-right text-xs" title="Prix max d'achat au coef supposé, ROI visé déduit · valeur des runes à 100 %">
        <span className="block font-semibold text-encre">≤ {formatKamas(s.prixMax)}</span>
        {s.beneficeEstime === null ? (
          <span className="block text-[10px] text-encre-2">{formatKamas(s.eval.valeurMeilleure)} de runes</span>
        ) : s.beneficeEstime > 0 ? (
          <span className="block text-[10px] text-ok">
            +{formatKamas(s.beneficeEstime)}{s.roiEstime !== null ? ` · ROI ${formatPct(s.roiEstime)}` : ''}{s.source === 'craft' ? ' · craft' : ''}
          </span>
        ) : (
          <span className="block text-[10px] text-alerte" title="À ce prix, rentable seulement si le concasseur affiche au moins ce coefficient">
            si coef ≥ {s.seuilEstime === null ? '—' : formatPct(s.seuilEstime, 0)}
          </span>
        )}
      </span>
      <span className="flex shrink-0 flex-col gap-0.5">
        <ChampNombre
          value={s.prixHdv}
          onChange={(v) => setPrixConstate(item.id, v)}
          vide
          placeholder={estimation ? `≈ ${formatNombre(estimation.prix)}` : 'HDV'}
          className={`w-22 [&>input]:h-6 [&>input]:text-xs ${s.source === 'hdv' ? '[&>input]:border-accent' : ''} ${estimation ? '[&>input]:placeholder:text-encre-3' : ''}`}
          aria-label={`Prix HDV ${item.nom}`}
          title="Prix vu en HDV : au-dessus du prix max il disparaît, en dessous il passe en bonne affaire"
        />
        <ChampNombre
          value={s.coutCraft}
          onChange={(v) => setCoutCraft(item.id, v)}
          vide
          placeholder={item.recetteConnue ? 'craft' : '—'}
          disabled={!item.recetteConnue}
          className={`w-22 [&>input]:h-6 [&>input]:text-xs ${s.source === 'craft' ? '[&>input]:border-accent' : ''}`}
          aria-label={`Coût de craft ${item.nom}`}
          title={item.recetteConnue ? 'Coût total du craft (ressources) : comparé au même prix max ; si retenu, l\'objet est évalué en jets max' : 'Pas de recette connue'}
        />
      </span>
      <button onClick={onAjouter} className="btn btn-petit shrink-0 px-1.5" aria-label={`Ajouter ${item.nom}`} title="Ajouter aux objets à tester">
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
  const index = useCatalogue((s) => s.index);
  // Kamas par point au milieu de la tranche de niveau parcourue.
  const kamasParPoint = useKamasParPoint(Math.max(20, Math.round(suggestions.niveauMax * 0.75)));
  const { choisirObjet, setChamp, setFocus } = useSimu();
  const [nbSession, setNbSession] = useState<number | null>(null);
  const [gainSession, setGainSession] = useState<number | null>(null);
  const [coefSession, setCoefSession] = useState<number | null>(null);
  const ajouterCoef = useNotes((s) => s.ajouterCoef);

  const objectifOk = g.kamasActuels !== null && g.objectif !== null && g.objectif > 0;
  const budget = budgetTest(g.kamasActuels, g.partBudgetTest);
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
          <label className="flex flex-col gap-0.5 text-xs text-encre-2">
            Kamas actuels
            <ChampNombre value={g.kamasActuels} onChange={g.setKamas} vide placeholder="ex. 2,5M" className="w-32" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-encre-2">
            Objectif
            <ChampNombre value={g.objectif} onChange={g.setObjectif} vide placeholder="ex. 10M" className="w-32" />
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-encre-2" title="Jets supposés des objets que tu achètes : « moyen » est prudent pour de l'HDV, « max » si tu craftes">
            Jets des objets
            <select value={g.jet} onChange={(e) => g.setJet(e.target.value as JetGuide)} className="champ">
              <option value="moyen">moyens (prudent)</option>
              <option value="max">max (craft)</option>
              <option value="min">min</option>
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-xs text-encre-2" title="Un test ne doit pas engloutir la bourse : plafond de prix pour un objet à tester">
            Budget par test
            <span className="flex items-center gap-1">
              <ChampNombre value={g.partBudgetTest} onChange={(v) => g.setPartBudgetTest(v ?? 5)} suffixe="%" className="w-20" />
              <span className="segment" role="radiogroup" aria-label="Préréglages du budget par test">
                {PARTS_BUDGET_TEST.map((p) => (
                  <button key={p} role="radio" aria-checked={g.partBudgetTest === p} onClick={() => g.setPartBudgetTest(p)}>
                    {p} %
                  </button>
                ))}
              </span>
              {budget !== null && (
                <span className="tnum text-xs text-encre-2">
                  = {formatKamas(budget)} · ~{Math.max(1, Math.floor(100 / g.partBudgetTest))} tests
                </span>
              )}
            </span>
          </label>
          {objectifOk && (
            <div className="min-w-56 flex-1">
              <div className="mb-1 flex justify-between text-xs text-encre-2">
                <span className="tnum">{formatKamas(g.kamasActuels!)}</span>
                <span className="tnum">
                  {atteint ? 'objectif atteint 🎉' : `reste ${formatKamas(g.objectif! - g.kamasActuels!)}`} · {formatKamas(g.objectif!)}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-fond-2">
                <div className="h-full rounded-full bg-gradient-to-r from-accent to-ok transition-all" style={{ width: `${progression * 100}%` }} />
              </div>
            </div>
          )}
        </div>
      </Etape>

      {/* 2. Farm gratuit */}
      <Etape n={2} titre="Farmer : des objets gratuits" actif={objectifOk} aide="ce que tu peux looter à ton niveau, zéro mise de départ">
        <SectionFarm />
      </Etape>

      {/* 3. Candidats HDV */}
      <Etape
        n={3}
        titre="Acheter : objets à tester"
        actif={objectifOk}
        aide={budget !== null ? `un test ≤ ${formatKamas(budget)} — et briser rend des runes : la mise réelle est bien moindre que le prix` : undefined}
      >
        {nbPrixRunes === 0 && <p className="text-sm text-alerte">Catalogue non chargé.</p>}
        {evalues.length > 0 && (
          <div className="carte mb-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-encre-2">
                <tr className="border-b border-bord">
                  <th className="px-2 py-1.5 font-medium">Objet</th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Repère à coef. 100 %">
                    Runes @100 %
                  </th>
                  <th className="px-2 py-1.5 font-medium">HDV / craft</th>
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
            <h3 className="mb-1 titre-section">Guide d'achat HDV (non droppables, runes toutes pricées)</h3>
            <div className="mb-2 flex flex-wrap items-end gap-x-3 gap-y-1 text-xs text-encre-2">
              <label className="flex flex-col gap-0.5" title="Coefficient que tu supposes lire au concasseur ; ajuste-le d'après tes tests">
                Coef supposé
                <ChampNombre value={g.coefSuppose} onChange={(v) => g.setCoefSuppose(v ?? 100)} suffixe="%" className="w-20" />
              </label>
              <label className="flex flex-col gap-0.5" title="Marge minimale voulue sur chaque objet">
                ROI visé
                <ChampNombre value={g.roiVise} onChange={(v) => g.setRoiVise(v ?? 30)} suffixe="%" className="w-20" />
              </label>
              <label className="flex flex-col gap-0.5" title="Comme les onglets de l'HDV">
                Catégorie HDV
                <select value={g.categorieHdv} onChange={(e) => g.setCategorieHdv(e.target.value)} className="champ">
                  <option value="">Toutes</option>
                  <option value="Arme">Toutes armes</option>
                  {index?.types.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mb-2 rounded-lg border border-bord bg-surface-2 px-2 py-1.5 text-xs">
              <span className="titre-section">Ce qui rapporte, par point, sur un objet niv. ~{Math.max(20, Math.round(suggestions.niveauMax * 0.75))}</span>
              <div className="mt-1 flex flex-wrap gap-1">
                {kamasParPoint.slice(0, 14).map((k) => (
                  <span key={k.statId} className="tnum rounded bg-surface px-1.5 py-0.5" title="Kamas de runes par point de la caractéristique, brisage naturel à 100 %">
                    {k.label} <span className="text-encre-2">{formatNombre(k.kamasParPoint, 1)}/pt</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="mb-1 flex flex-wrap items-center gap-1 text-xs">
              <span className="text-encre-2">Niveau ≤</span>
              {TRANCHES.map((n) => (
                <button
                  key={n}
                  onClick={() => g.setNiveauMaxSuggestions(n)}
                  className={`rounded border px-1.5 py-0.5 ${suggestions.niveauMax === n ? 'border-accent bg-accent text-white' : 'border-bord-fort text-encre-2'}`}
                >
                  {n}
                </button>
              ))}
              {suggestions.auto ? (
                <span className="text-encre-2" title="L'app ne connaît pas les prix HDV : le niveau est le seul repère de prix. Tranche pré-choisie d'après ta bourse, à ajuster.">
                  (indicatif d'après ta bourse)
                </span>
              ) : (
                <button onClick={() => g.setNiveauMaxSuggestions(null)} className="lien">
                  auto
                </button>
              )}
              <span className="ml-auto text-encre-2">tri</span>
              <select
                value={g.triSuggestions}
                onChange={(e) => g.setTriSuggestions(e.target.value as 'densite' | 'valeur')}
                className="champ h-6 px-1 text-xs"
              >
                <option value="densite">valeur ÷ niveau</option>
                <option value="valeur">valeur brute</option>
              </select>
            </div>
            {suggestions.surMesure.length > 0 && (
              <>
                <div className="mb-1 mt-2 text-[11px] font-medium uppercase tracking-wide text-ok">Bonnes affaires — prix noté sous le prix max</div>
                <ul className="mb-2 divide-y divide-ok/30 rounded-lg border border-ok/40 bg-ok-doux/50">
                  {suggestions.surMesure.map((s) => (
                    <LigneSuggestion key={s.eval.item.id} s={s} onAjouter={() => g.ajouterCandidat(s.eval.item.id)} />
                  ))}
                </ul>
              </>
            )}
            {suggestions.siCoefEleve.length > 0 && (
              <details className="mb-2">
                <summary className="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-alerte">
                  Rentables seulement si le coef est haut ({suggestions.siCoefEleve.length}) — à tester au concasseur
                </summary>
                <ul className="mt-1 divide-y divide-alerte/30 rounded-lg border border-alerte/40">
                  {suggestions.siCoefEleve.map((s) => (
                    <LigneSuggestion key={s.eval.item.id} s={s} onAjouter={() => g.ajouterCandidat(s.eval.item.id)} />
                  ))}
                </ul>
              </details>
            )}
            <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-encre-2">À repérer en HDV — note le prix que tu vois</div>
            <ul className="carte divide-y divide-bord">
              {suggestions.aChiffrer.map((s) => (
                <LigneSuggestion key={s.eval.item.id} s={s} onAjouter={() => g.ajouterCandidat(s.eval.item.id)} />
              ))}
              {suggestions.aChiffrer.length === 0 && <li className="px-2 py-1 text-xs text-encre-2">Plus rien à chiffrer dans cette tranche.</li>}
            </ul>
            <p className="mt-1 text-xs text-encre-2">
              Aucune API ne donne les prix HDV ni le coût des ressources : parcours la catégorie en HDV (ou chiffre la recette), compare au « ≤ » ; le moins cher des deux est retenu, et un craft retenu est évalué en jets max. Un prix noté au-dessus du prix max (ou du budget de test) retire l'objet
              {suggestions.nbTropChers > 0 && <span className="tnum"> ({suggestions.nbTropChers} masqué{suggestions.nbTropChers > 1 ? 's' : ''} pour l'instant)</span>}, un prix
              sous le prix max le fait remonter en « bonnes affaires »
              {suggestions.nbNonRentables > 0 && (
                <span className="tnum">
                  {' '}
                  ; {suggestions.nbNonRentables} abordable{suggestions.nbNonRentables > 1 ? 's' : ''} mais jamais rentable{suggestions.nbNonRentables > 1 ? 's' : ''} sous 300 %
                </span>
              )}
              .
            </p>
            <button onClick={() => aller('explorateur')} className="mt-1 text-xs lien">
              Voir tout l'explorateur →
            </button>
          </div>
          <div>
            <h3 className="mb-1 titre-section">Ajouter un objet précis</h3>
            <RechercheObjet onChoisir={(it) => g.ajouterCandidat(it.id)} />
            <p className="mt-2 text-xs text-encre-2">
              Le test : achète (ou crafte) un exemplaire, note son prix, ouvre le concasseur et note le coefficient affiché. Le bénéfice par objet et le seuil se
              calculent avec tes prix de runes. Tu ne notes que tes candidats (5 à 10 objets), jamais tout le catalogue ; un prix reste valable jusqu'à ce que tu le
              changes, et passe en orange au bout de {JOURS_PERIME} jours.
            </p>
          </div>
        </div>
      </Etape>

      {/* 4. Stratégie */}
      <Etape n={4} titre="Stratégie" actif={objectifOk && prets.length > 0} aide={prets.length === 0 ? 'apparaît dès qu’un objet testé est rentable' : undefined}>
        {strategie && strategie.plan && (
          <div className="space-y-2">
            <div className="rounded border border-ok/40 bg-ok-doux p-3">
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
                  <div className="text-[11px] uppercase text-encre-2">Ce cycle</div>
                  <div className="font-semibold">{formatNombre(strategie.plan.objetsPremierCycle)} objets</div>
                  <div className="text-xs text-encre-2">≈ {formatKamas(strategie.plan.objetsPremierCycle * (strategie.prix ?? 0))} investis</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-encre-2">Gain du cycle</div>
                  <div className="font-semibold text-ok">+{formatKamas(strategie.plan.gainPremierCycle)}</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-encre-2">Cycles jusqu'à l'objectif</div>
                  <div className="font-semibold">{strategie.plan.cycles === null ? 'hors de portée' : strategie.plan.cycles === 0 ? 'atteint' : strategie.plan.cycles}</div>
                  <div className="text-xs text-encre-2">en réinvestissant tout</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase text-encre-2">Objets au total</div>
                  <div className="font-semibold">{strategie.plan.cycles ? formatNombre(strategie.plan.objetsTotal) : '—'}</div>
                </div>
              </div>
              <p className="mt-2 text-xs text-encre-2">
                Le coefficient baisse à chaque brisage : re-note-le après chaque session (étape 4). Dès qu'il passe sous le seuil, bascule sur le suivant.
              </p>
            </div>
            {prets.length > 1 && (
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-encre-2">
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
                    <tr key={e.item.id} className={`border-t border-bord ${e === strategie ? 'font-medium' : ''}`}>
                      <td className="px-2 py-1">
                        {e === strategie && <span className="mr-1 text-ok">★</span>}
                        {e.item.nom}
                      </td>
                      <td className="tnum px-2 py-1 text-right">{formatKamas(e.benefice)}</td>
                      <td className="tnum px-2 py-1 text-right">{e.plan ? `+${formatKamas(e.plan.gainPremierCycle)}` : '—'}</td>
                      <td className="tnum px-2 py-1 text-right">{e.plan?.cycles ?? '—'}</td>
                      <td className="px-2 py-1 text-right">
                        {e !== strategie && (
                          <button onClick={() => g.retenir(e.item.id)} className="text-xs lien">
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

      {/* 5. Suivi */}
      <Etape n={5} titre="Suivi" actif={objectifOk && (strategie !== null || g.sessions.length > 0)}>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <h3 className="mb-1 titre-section">Enregistrer une session</h3>
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-0.5 text-xs text-encre-2">
                Objet
                <select
                  value={itemSession?.id ?? ''}
                  onChange={(e) => setSessionItemId(Number(e.target.value))}
                  className="champ max-w-48"
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
              <label className="flex flex-col gap-0.5 text-xs text-encre-2">
                Brisés
                <ChampNombre value={nbSession} onChange={setNbSession} vide className="w-16" />
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-encre-2" title="Ventes de runes − achats d'objets, taxe déduite">
                Gain net (kamas)
                <ChampNombre value={gainSession} onChange={setGainSession} vide placeholder="ex. 450k" className="w-28" />
              </label>
              <label className="flex flex-col gap-0.5 text-xs text-encre-2">
                Coef en fin de session
                <ChampNombre value={coefSession} onChange={setCoefSession} vide suffixe="%" decimales={1} className="w-24" />
              </label>
              <button
                onClick={enregistrerSession}
                disabled={!itemSession || nbSession === null || gainSession === null}
                className="btn btn-primaire"
              >
                Enregistrer
              </button>
            </div>
            <p className="mt-1 text-xs text-encre-2">Le gain s'ajoute à tes kamas actuels ; le coef noté met à jour la stratégie.</p>
            {g.sessions.length > 0 && (
              <ul className="mt-2 max-h-48 divide-y divide-bord overflow-y-auto text-xs">
                {[...g.sessions].reverse().map((s) => (
                  <li key={s.id} className="flex items-center gap-2 py-1">
                    <span className="tnum w-20 text-encre-2">{formatDate(s.date)}</span>
                    <span className="truncate">{parId.get(s.itemId)?.nom ?? `#${s.itemId}`}</span>
                    <span className="tnum text-encre-2">× {s.nbObjets}</span>
                    <span className={`tnum ml-auto font-medium ${s.gain >= 0 ? 'text-ok' : 'text-ko'}`}>
                      {s.gain >= 0 ? '+' : ''}
                      {formatKamas(s.gain)}
                    </span>
                    <button onClick={() => g.supprimerSession(s.id)} className="text-encre-3 hover:text-ko" aria-label="Supprimer la session">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h3 className="mb-1 titre-section">Progression</h3>
            {g.historiqueKamas.length >= 2 ? (
              <Courbe
                points={g.historiqueKamas.map((p) => ({ date: p.date, valeur: p.kamas }))}
                formatY={formatKamas}
                reference={g.objectif !== null ? { valeur: g.objectif, label: 'objectif' } : undefined}
                ariaLabel="Évolution des kamas"
              />
            ) : (
              <p className="text-xs text-encre-2">La courbe apparaît après ta première session.</p>
            )}
            {g.sessions.length > 0 && (
              <p className="tnum mt-1 text-xs text-encre-2">
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
          className="text-xs text-encre-3 hover:text-ko"
        >
          Réinitialiser le guide
        </button>
      </div>
    </div>
  );
}
