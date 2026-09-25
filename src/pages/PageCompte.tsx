import { useMemo } from 'react';
import { STAT_BY_ID, placeholderPour } from '../data/statMapping.ts';
import { evaluerFarm, recommanderBrisage } from '../engine/index.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import type { Onglet } from '../components/EnTete.tsx';
import { ItemImage } from '../components/ItemImage.tsx';
import { Sauvegarde } from '../components/Sauvegarde.tsx';
import { useCouts } from '../hooks/useCouts.ts';
import { useContexte } from '../hooks/useSimulation.ts';
import { formatKamas, formatNombre, formatPct } from '../lib/format.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { useCompte } from '../store/compte.ts';
import { useNotes } from '../store/notes.ts';
import { useStorePrix } from '../store/prix.ts';
import { useReglages } from '../store/reglages.ts';
import { useSimu } from '../store/simu.ts';

function Bloc({ titre, aide, children }: { titre: string; aide?: string; children: React.ReactNode }) {
  return (
    <section className="carte p-4">
      <h2 className="text-base font-semibold">{titre}</h2>
      {aide && <p className="mb-3 text-xs text-encre-2">{aide}</p>}
      {!aide && <div className="mb-3" />}
      {children}
    </section>
  );
}

/** Ton compte : ce que tu as, et ce que l'app te conseille d'en faire. */
export function PageCompte({ aller }: { aller: (o: Onglet) => void }) {
  const items = useCatalogue((s) => s.items);
  const parId = useCatalogue((s) => s.parId);
  const runes = useCatalogue((s) => s.runes);
  const monstres = useCatalogue((s) => s.monstres);
  const ctx = useContexte();
  const couts = useCouts();
  const prixRunes = useStorePrix((s) => s.prix);
  const prixConstates = useNotes((s) => s.prixConstates);
  const coutsCraft = useNotes((s) => s.coutsCraft);
  const { budget, niveau, prospection, roiMin, setBudget, setNiveau, setProspection, setRoiMin } = useCompte();
  const { coefSuppose, setCoefSuppose, serveur } = useReglages();
  const taxePct = useSimu((s) => s.taxePct);
  const { choisirObjet, setChamp, setFocus } = useSimu();

  const opportunites = useMemo(
    () => recommanderBrisage(items, ctx, { budget, coefficient: coefSuppose, taxePct, jet: 'moyen', couts, roiMin }),
    [items, ctx, budget, coefSuppose, taxePct, couts, roiMin],
  );

  const farm = useMemo(
    () =>
      evaluerFarm(monstres, parId, ctx, {
        niveauJoueur: niveau,
        prospection,
        coefficient: coefSuppose,
        taxePct,
        jet: 'moyen',
        ecartNiveauMax: 10,
      }).slice(0, 5),
    [monstres, parId, ctx, niveau, prospection, coefSuppose, taxePct],
  );

  const achats = opportunites.filter((o) => o.source === 'hdv').slice(0, 8);
  const crafts = opportunites.filter((o) => o.source === 'craft').slice(0, 5);
  const meilleur = opportunites[0];

  const nbRunes = Object.keys(prixRunes).length;
  const nbObjets = new Set([...Object.keys(prixConstates), ...Object.keys(coutsCraft)]).size;
  const brisables = items.filter((i) => !i.nonBrisable && i.stats.length > 0).length;

  const ouvrir = (o: (typeof opportunites)[number]) => {
    choisirObjet(o.item);
    setChamp('coefficient', coefSuppose);
    setChamp('prixRevient', o.cout);
    setFocus(o.focus);
    aller('objet');
  };

  return (
    <div className="space-y-4">
      <Bloc titre="Mon compte" aide={`Serveur ${serveur}. Tout le site s'appuie sur ces valeurs.`}>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3 text-xs text-encre-2">
          <label className="flex flex-col gap-0.5" title="Somme que tu acceptes d'engager dans du brisage">
            Kamas disponibles
            <ChampNombre value={budget} onChange={(v) => setBudget(v ?? 0)} className="w-36 [&>input]:h-10 [&>input]:text-lg [&>input]:font-bold" />
          </label>
          <label className="flex flex-col gap-0.5">
            Niveau du perso
            <ChampNombre value={niveau} onChange={(v) => setNiveau(v ?? 1)} className="w-20" />
          </label>
          <label className="flex flex-col gap-0.5" title="Ta prospection totale en jeu (elle inclut déjà la chance : 1 point pour 10)">
            Prospection
            <ChampNombre value={prospection} onChange={(v) => setProspection(v ?? 100)} className="w-20" />
          </label>
          <label className="flex flex-col gap-0.5" title="Coefficient que tu supposes lire au concasseur">
            Coefficient supposé
            <ChampNombre value={coefSuppose} onChange={(v) => setCoefSuppose(v ?? 100)} suffixe="%" className="w-24" />
          </label>
          <label className="flex flex-col gap-0.5" title="En dessous de cette marge, un objet n'est pas proposé">
            Marge minimale
            <ChampNombre value={roiMin} onChange={(v) => setRoiMin(v ?? 0)} suffixe="%" className="w-24" />
          </label>
          <label className="flex flex-col gap-0.5" title="Taxe prélevée à la vente des runes">
            Taxe de vente
            <ChampNombre value={taxePct} onChange={(v) => setChamp('taxePct', Math.min(100, Math.max(0, v ?? 0)))} suffixe="%" className="w-24" />
          </label>
        </div>
      </Bloc>

      {/* La réponse attendue : quoi faire maintenant */}
      {budget <= 0 ? (
        <p className="rounded-lg border border-info/40 bg-info-doux px-3 py-2 text-sm text-info">
          Indique tes kamas disponibles ci-dessus : l'app te dira quoi acheter et briser en premier.
        </p>
      ) : meilleur ? (
        <section className="carte border-accent/50 p-4">
          <h2 className="titre-section">À faire maintenant</h2>
          <p className="mt-1 text-lg">
            Achète <strong className="tnum text-accent">{formatNombre(meilleur.quantite)}</strong> ×{' '}
            <strong>{meilleur.item.nom}</strong> à <span className="tnum">{formatKamas(meilleur.cout)}</span> et{' '}
            {meilleur.focus === null ? 'brise-les naturellement' : <>brise-les en <strong>focus {STAT_BY_ID[meilleur.focus].label}</strong></>}.
          </p>
          <p className="tnum mt-1 text-sm text-encre-2">
            Gain attendu <strong className="text-ok">+{formatKamas(meilleur.beneficeTotal)}</strong> ({formatKamas(meilleur.benefice)} par objet, ROI{' '}
            {formatPct(meilleur.roi)}) · rentable tant que le coefficient reste au-dessus de{' '}
            {meilleur.seuil === null ? '—' : formatPct(meilleur.seuil, 0)}
          </p>
          <button onClick={() => ouvrir(meilleur)} className="btn btn-primaire mt-3">
            Ouvrir dans le simulateur →
          </button>
        </section>
      ) : (
        <p className="rounded-lg border border-alerte/40 bg-alerte-doux px-3 py-2 text-sm text-alerte">
          Rien de rentable avec les prix relevés, ce coefficient ({formatPct(coefSuppose, 0)}) et cette marge minimale ({formatPct(roiMin, 0)}). Renseigne plus de
          prix d'objets, baisse la marge exigée, ou vérifie ton coefficient au concasseur.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloc titre="Acheter puis briser" aide="Classé par gain total que ton budget permet, pas par marge unitaire.">
          {achats.length === 0 ? (
            <p className="text-sm text-encre-2">
              Aucun objet acheté en HDV n'est rentable pour l'instant.{' '}
              <button onClick={() => aller('prixObjets')} className="lien">
                Renseigner des prix →
              </button>
            </p>
          ) : (
            <ul className="divide-y divide-bord">
              {achats.map((o) => (
                <li key={o.item.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <ItemImage src={o.item.imageLocale} alt="" fallback={placeholderPour(o.item.type, o.item.famille)} taille={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.item.nom}</span>
                    <span className="tnum block text-[11px] text-encre-2">
                      {formatKamas(o.cout)} · ×{formatNombre(o.quantite)} · {o.focus === null ? 'naturel' : `focus ${STAT_BY_ID[o.focus].label}`}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-right">
                    <span className="block font-medium text-ok">+{formatKamas(o.beneficeTotal)}</span>
                    <span className="block text-[11px] text-encre-2">ROI {formatPct(o.roi)}</span>
                  </span>
                  <button onClick={() => ouvrir(o)} className="btn btn-petit shrink-0">
                    ouvrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Bloc>

        <Bloc titre="Crafter puis briser" aide="Objets dont tu as chiffré le coût de craft.">
          {crafts.length === 0 ? (
            <p className="text-sm text-encre-2">
              Aucun craft rentable chiffré.{' '}
              <button onClick={() => aller('prixObjets')} className="lien">
                Renseigner un coût de craft →
              </button>
            </p>
          ) : (
            <ul className="divide-y divide-bord">
              {crafts.map((o) => (
                <li key={o.item.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <ItemImage src={o.item.imageLocale} alt="" fallback={placeholderPour(o.item.type, o.item.famille)} taille={24} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{o.item.nom}</span>
                    <span className="tnum block text-[11px] text-encre-2">
                      craft {formatKamas(o.cout)} · ×{formatNombre(o.quantite)}
                    </span>
                  </span>
                  <span className="tnum shrink-0 font-medium text-ok">+{formatKamas(o.beneficeTotal)}</span>
                  <button onClick={() => ouvrir(o)} className="btn btn-petit shrink-0">
                    ouvrir
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Bloc>
      </div>

      <Bloc titre="Droper puis briser" aide={`Monstres de ton niveau (±10) qui lâchent des équipements brisables, à ${formatNombre(prospection)} de prospection.`}>
        {farm.length === 0 ? (
          <p className="text-sm text-encre-2">Aucun monstre de ton niveau ne lâche d'équipement brisable.</p>
        ) : (
          <ul className="divide-y divide-bord">
            {farm.map((m) => (
              <li key={m.monstre.id} className="flex items-center gap-2 py-1.5 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">
                    {m.monstre.nom}
                    {m.monstre.boss && <span className="badge ml-1 bg-alerte-doux text-alerte">boss</span>}
                  </span>
                  <span className="block truncate text-[11px] text-encre-2">
                    niv. {m.monstre.niveau} · {m.monstre.zones[0] ?? 'zone inconnue'}
                  </span>
                </span>
                <span className="tnum shrink-0 text-right">
                  <span className="block font-medium text-ok">+{formatKamas(m.valeurParCombat)}</span>
                  <span className="block text-[11px] text-encre-2">par combat</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Bloc>

      <Bloc titre="Fiabilité de mes données" aide="Plus tu relèves de prix, plus les conseils ci-dessus sont justes.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-bord p-3">
            <div className="tnum text-lg font-semibold">
              {formatNombre(nbRunes)} / {formatNombre(runes.length)}
            </div>
            <div className="text-xs text-encre-2">prix de runes renseignés</div>
            <button onClick={() => aller('prix')} className="lien mt-1 text-xs">
              compléter →
            </button>
          </div>
          <div className="rounded-lg border border-bord p-3">
            <div className="tnum text-lg font-semibold">
              {formatNombre(nbObjets)} / {formatNombre(brisables)}
            </div>
            <div className="text-xs text-encre-2">prix d'objets chiffrés</div>
            <button onClick={() => aller('prixObjets')} className="lien mt-1 text-xs">
              compléter →
            </button>
          </div>
        </div>
        <div className="mt-3 border-t border-bord pt-3">
          <Sauvegarde />
        </div>
      </Bloc>
    </div>
  );
}
