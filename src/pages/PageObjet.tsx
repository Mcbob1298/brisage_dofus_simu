import { STAT_BY_ID, placeholderPour } from '../data/statMapping.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { useSimu } from '../store/simu.ts';
import { ItemImage } from '../components/ItemImage.tsx';
import { RechercheObjet } from '../components/RechercheObjet.tsx';
import { LignesStats } from '../components/LignesStats.tsx';
import { ParametresSimu } from '../components/ParametresSimu.tsx';
import { BilanDetaille, Butin } from '../components/Resultats.tsx';
import { Reglages } from '../components/Reglages.tsx';
import { JournalCoefficients } from '../components/JournalCoefficients.tsx';
import { useComparaisonFocus, type Simulation } from '../hooks/useSimulation.ts';
import { formatKamas } from '../lib/format.ts';
import type { Onglet } from '../components/EnTete.tsx';

function Badge({ children, ton = 'neutre' }: { children: React.ReactNode; ton?: 'neutre' | 'alerte' | 'ok' }) {
  const cls = {
    neutre: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
    alerte: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    ok: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  }[ton];
  return <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{children}</span>;
}

function Carte({ titre, children, className = '' }: { titre?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {titre && <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{titre}</h3>}
      {children}
    </div>
  );
}

/** Rappel compact du meilleur focus quand il bat la stratégie en cours. */
function ConseilFocus({ sim, onVoir }: { sim: Simulation; onVoir: () => void }) {
  const comp = useComparaisonFocus(sim);
  if (comp.length < 2) return null;
  const cle = sim.bilan.retenu;
  const meilleur = comp[0];
  const courant = comp.find((c) => c.focus === sim.entree.focus) ?? comp[0];
  const gain = meilleur.bilan[cle].benefice - courant.bilan[cle].benefice;
  if (meilleur.focus === sim.entree.focus || gain <= 0) return null;
  return (
    <p className="rounded border border-sky-200 bg-sky-50 px-2 py-1 text-xs text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
      {meilleur.focus === null ? 'Le brisage naturel' : `Un focus ${STAT_BY_ID[meilleur.focus].label}`} rapporterait{' '}
      <span className="tnum font-medium">+{formatKamas(gain)}</span>.{' '}
      <button onClick={onVoir} className="underline">
        Voir le comparateur
      </button>
    </p>
  );
}

export function PageObjet({ sim, aller }: { sim: Simulation | null; aller: (o: Onglet) => void }) {
  const { statut, erreur } = useCatalogue();
  const choisirObjet = useSimu((s) => s.choisirObjet);
  const setChamp = useSimu((s) => s.setChamp);
  const item = sim?.item;

  return (
    <div className="space-y-3">
      <RechercheObjet onChoisir={choisirObjet} />

      {statut === 'erreur' && (
        <p className="rounded border border-red-300 bg-red-50 p-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          Catalogue introuvable ({erreur}). Lance <code>npm run sync-data</code> puis recharge.
        </p>
      )}

      {!item && statut === 'pret' && (
        <p className="text-sm text-zinc-500">Cherche un objet pour remplir ses caractéristiques automatiquement.</p>
      )}

      {item && sim && (
        <>
          <section className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Carte>
              <div className="mb-3 flex items-center gap-3">
                <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={48} />
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{item.nom}</h2>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                    <span className="tnum">niveau {item.niveau}</span>
                    <span>·</span>
                    <span>{item.type}</span>
                    {item.droppable === true && <Badge ton="alerte">droppable</Badge>}
                    {item.droppable === false && <Badge ton="ok">non droppable</Badge>}
                    {item.recetteConnue && <Badge>recette</Badge>}
                    {item.panoplieId !== undefined && <Badge>panoplie</Badge>}
                  </div>
                </div>
              </div>
              <LignesStats />
            </Carte>

            <div className="space-y-3">
              <Carte titre="Paramètres">
                <ParametresSimu />
              </Carte>
              <Carte titre="Bilan">
                <BilanDetaille sim={sim} />
              </Carte>
            </div>
          </section>

          <ConseilFocus sim={sim} onVoir={() => aller('comparateur')} />

          <section className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Carte titre="Butin">
              <Butin sim={sim} onVoirPrix={() => aller('prix')} />
            </Carte>
            <div className="space-y-3">
              <Carte titre="Journal des coefficients">
                <JournalCoefficients itemId={item.id} onAppliquer={(c) => setChamp('coefficient', c)} />
              </Carte>
              <Carte titre="Réglages du moteur">
                <Reglages />
              </Carte>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
