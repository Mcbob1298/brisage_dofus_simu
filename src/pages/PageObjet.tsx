import { useCatalogue } from '../store/catalogue.ts';
import { useSimu } from '../store/simu.ts';
import { RechercheObjet } from '../components/RechercheObjet.tsx';
import { CarteObjet } from '../components/CarteObjet.tsx';
import { ParametresSimu } from '../components/ParametresSimu.tsx';
import { BilanDetaille, Butin } from '../components/Resultats.tsx';
import { Reglages } from '../components/Reglages.tsx';
import { JournalCoefficients } from '../components/JournalCoefficients.tsx';
import { STAT_BY_ID } from '../data/statMapping.ts';
import { useComparaisonFocus, type Simulation } from '../hooks/useSimulation.ts';
import { formatKamas } from '../lib/format.ts';
import type { Onglet } from '../components/EnTete.tsx';

function Carte({ titre, children }: { titre?: string; children: React.ReactNode }) {
  return (
    <div className="carte p-4">
      {titre && <h3 className="mb-2 titre-section">{titre}</h3>}
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
    <p className="rounded-lg border border-info/40 bg-info-doux px-3 py-2 text-sm text-info">
      {meilleur.focus === null ? 'Le brisage naturel' : `Un focus ${STAT_BY_ID[meilleur.focus].label}`} rapporterait{' '}
      <span className="tnum font-semibold">+{formatKamas(gain)}</span>.{' '}
      <button onClick={onVoir} className="underline">
        Voir le comparateur
      </button>
    </p>
  );
}

export function PageObjet({ sim, aller }: { sim: Simulation | null; aller: (o: Onglet) => void }) {
  const { statut, erreur } = useCatalogue();
  const choisirObjet = useSimu((s) => s.choisirObjet);
  const item = sim?.item;

  return (
    <div className="space-y-4">
      <RechercheObjet onChoisir={choisirObjet} />

      {statut === 'erreur' && (
        <p className="rounded-lg border border-ko/40 bg-ko-doux p-3 text-sm text-ko">
          Catalogue introuvable ({erreur}). Lance <code>npm run sync-data</code> puis recharge.
        </p>
      )}

      {!item && statut === 'pret' && (
        <p className="text-sm text-encre-2">Cherche un objet : ses caractéristiques se remplissent automatiquement.</p>
      )}

      {item && sim && (
        <>
          <CarteObjet sim={sim} />
          <ConseilFocus sim={sim} onVoir={() => aller('comparateur')} />

          <section className="grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Carte titre="Butin détaillé">
              <Butin sim={sim} onVoirPrix={() => aller('prix')} />
            </Carte>
            <div className="space-y-4">
              <Carte titre="Paramètres">
                <ParametresSimu />
              </Carte>
              <Carte titre="Bilan">
                <BilanDetaille sim={sim} />
              </Carte>
              <Carte titre="Journal des coefficients">
                <JournalCoefficients itemId={item.id} onAppliquer={(c) => useSimu.getState().setChamp('coefficient', c)} />
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
