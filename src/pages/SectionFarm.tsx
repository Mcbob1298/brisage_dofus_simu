import { Fragment, useMemo, useState } from 'react';
import { placeholderPour } from '../data/statMapping.ts';
import { evaluerFarm, type MonstreEvalue } from '../engine/index.ts';
import { ChampNombre } from '../components/ChampNombre.tsx';
import { ItemImage } from '../components/ItemImage.tsx';
import { useContexte } from '../hooks/useSimulation.ts';
import { formatKamas, formatNombre, formatPct } from '../lib/format.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { useGuide } from '../store/guide.ts';
import { useSimu } from '../store/simu.ts';

/** Détail d'un monstre : ce qu'il lâche et ce que ça rapporte en runes. */
function Detail({ m }: { m: MonstreEvalue }) {
  return (
    <tr>
      <td colSpan={5} className="px-2 pb-2">
        <div className="rounded-lg border border-bord bg-surface-2 p-2">
          <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-encre-2">
            <span className="titre-section">Lâche</span>
            {m.monstre.zones.length > 0 && <span>· {m.monstre.zones.join(' · ')}</span>}
          </div>
          <ul className="space-y-0.5">
            {m.drops.map((d) => (
              <li key={d.item.id} className="flex items-center gap-2 text-xs">
                <ItemImage src={d.item.imageLocale} alt="" fallback={placeholderPour(d.item.type, d.item.famille)} taille={20} />
                <span className="min-w-0 flex-1 truncate">
                  {d.item.nom} <span className="text-encre-2">niv. {d.item.niveau}</span>
                </span>
                <span className="tnum w-16 text-right text-encre-2" title="Taux de drop, prospection appliquée">
                  {formatPct(d.taux, d.taux < 1 ? 2 : 1)}
                </span>
                <span className="tnum w-20 text-right" title="Valeur des runes de cet objet">
                  {formatKamas(d.valeurObjet)}
                </span>
                <span className="tnum w-20 text-right text-ok" title="Contribution au gain d'un combat">
                  +{formatKamas(d.valeurParCombat)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </td>
    </tr>
  );
}

/** Étape « farm » : quels monstres taper pour récupérer des objets à briser gratuitement. */
export function SectionFarm() {
  const monstres = useCatalogue((s) => s.monstres);
  const parId = useCatalogue((s) => s.parId);
  const ctx = useContexte();
  const taxePct = useSimu((s) => s.taxePct);
  const g = useGuide();
  const [ouvert, setOuvert] = useState<number | null>(null);
  const [combatsParHeure, setCombatsParHeure] = useState<number | null>(30);

  const resultats = useMemo(
    () =>
      evaluerFarm(monstres, parId, ctx, {
        niveauJoueur: g.niveauJoueur,
        prospection: g.prospection,
        coefficient: g.coefSuppose,
        taxePct,
        jet: 'moyen',
        ecartNiveauMax: g.ecartNiveauFarm,
      }),
    [monstres, parId, ctx, g.niveauJoueur, g.prospection, g.coefSuppose, g.ecartNiveauFarm, taxePct],
  );

  const meilleur = resultats[0];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 text-xs text-encre-2">
        <label className="flex flex-col gap-0.5">
          Niveau du perso
          <ChampNombre value={g.niveauJoueur} onChange={(v) => g.setNiveauJoueur(v ?? 1)} className="w-20" />
        </label>
        <label className="flex flex-col gap-0.5" title="Taux de base = 100 pp. La mise à l'échelle linéaire avec la prospection est une approximation.">
          Prospection
          <ChampNombre value={g.prospection} onChange={(v) => g.setProspection(v ?? 100)} className="w-20" />
        </label>
        <label className="flex flex-col gap-0.5" title="Monstres jusqu'à ce nombre de niveaux au-dessus du tien">
          Écart de niveau
          <ChampNombre value={g.ecartNiveauFarm} onChange={(v) => g.setEcartNiveauFarm(v ?? 10)} suffixe="+" className="w-20" />
        </label>
        <label className="flex flex-col gap-0.5" title="Pour convertir le gain par combat en gain horaire">
          Combats / heure
          <ChampNombre value={combatsParHeure} onChange={setCombatsParHeure} vide className="w-20" />
        </label>
      </div>

      {monstres.length === 0 ? (
        <p className="text-sm text-encre-2">
          Données de drop absentes : relance <code>npm run sync-data</code>.
        </p>
      ) : resultats.length === 0 ? (
        <p className="text-sm text-encre-2">
          Aucun monstre de ton niveau ne lâche d'équipement brisable. Augmente l'écart de niveau, ou passe à l'achat en HDV ci-dessous.
        </p>
      ) : (
        <>
          {meilleur && (
            <p className="rounded-lg border border-ok/40 bg-ok-doux px-3 py-2 text-sm">
              <strong>Va taper {meilleur.monstre.nom}</strong>
              {meilleur.monstre.zones[0] && <> — {meilleur.monstre.zones[0]}</>} : ≈{' '}
              <span className="tnum">{formatKamas(meilleur.valeurParCombat)}</span> de runes par combat
              {combatsParHeure !== null && combatsParHeure > 0 && (
                <>
                  , soit <span className="tnum">{formatKamas(meilleur.valeurParCombat * combatsParHeure)}</span> / heure
                </>
              )}
              . Les objets lâchés ne coûtent rien : tout ce qu'ils rendent est du bénéfice.
            </p>
          )}
          <div className="carte overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-encre-2">
                <tr className="border-b border-bord">
                  <th className="px-2 py-1.5 font-medium">Monstre</th>
                  <th className="px-2 py-1.5 text-right font-medium">Niv.</th>
                  <th className="px-2 py-1.5 font-medium">Zone</th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Kamas de runes espérés par combat gagné">
                    Par combat
                  </th>
                  <th className="px-2 py-1.5 text-right font-medium" title="Combats à enchaîner pour un objet, toutes cibles confondues">
                    Combats / objet
                  </th>
                </tr>
              </thead>
              <tbody>
                {resultats.slice(0, 40).map((m) => (
                  <Fragment key={m.monstre.id}>
                    <tr
                      onClick={() => setOuvert(ouvert === m.monstre.id ? null : m.monstre.id)}
                      className="cursor-pointer border-t border-bord hover:bg-accent-doux/40"
                    >
                      <td className="px-2 py-1">
                        <span className="mr-1 text-encre-2">{ouvert === m.monstre.id ? '▾' : '▸'}</span>
                        {m.monstre.nom}
                        {m.monstre.boss && <span className="badge ml-1 bg-alerte-doux text-alerte">boss</span>}
                        <span className="ml-1 text-[11px] text-encre-2">{m.drops.length} objet(s)</span>
                      </td>
                      <td className="tnum px-2 py-1 text-right">
                        {m.monstre.niveau}
                        {m.monstre.niveauMax !== m.monstre.niveau && `–${m.monstre.niveauMax}`}
                      </td>
                      <td className="max-w-48 truncate px-2 py-1 text-xs text-encre-2" title={m.monstre.zones.join(' · ')}>
                        {m.monstre.zones[0] ?? '—'}
                      </td>
                      <td className="tnum px-2 py-1 text-right font-medium text-ok">+{formatKamas(m.valeurParCombat)}</td>
                      <td className="tnum px-2 py-1 text-right text-encre-2">
                        {m.combatsParObjet === null ? '—' : formatNombre(m.combatsParObjet, m.combatsParObjet < 10 ? 1 : 0)}
                      </td>
                    </tr>
                    {ouvert === m.monstre.id && <Detail m={m} />}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-encre-2">
            Taux de drop issus des données du jeu (base 100 pp) ; la mise à l'échelle par la prospection est une approximation linéaire. Valeurs calculées avec tes
            prix de runes, au coefficient supposé ({formatPct(g.coefSuppose, 0)}), jets moyens, taxe déduite.
          </p>
        </>
      )}
    </div>
  );
}
