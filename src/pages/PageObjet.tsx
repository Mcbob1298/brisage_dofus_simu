import { useCatalogue } from '../store/catalogue.ts';
import { useSimu } from '../store/simu.ts';
import { RechercheObjet } from '../components/RechercheObjet.tsx';
import { CarteObjet } from '../components/CarteObjet.tsx';
import { ParametresSimu } from '../components/ParametresSimu.tsx';
import { BilanDetaille, Butin } from '../components/Resultats.tsx';
import { Reglages } from '../components/Reglages.tsx';
import { JournalCoefficients } from '../components/JournalCoefficients.tsx';
import type { Simulation } from '../hooks/useSimulation.ts';
import type { Onglet } from '../components/EnTete.tsx';

function Bloc({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="carte p-4">
      <h3 className="mb-2 titre-section">{titre}</h3>
      {children}
    </div>
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

      {!item && statut === 'pret' && <p className="text-sm text-encre-2">Cherche un objet : ses caractéristiques se remplissent automatiquement.</p>}

      {item && sim && (
        <>
          <CarteObjet sim={sim} />

          {/* Tout le reste est secondaire : replié par défaut. */}
          <details className="carte px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium text-encre-2 hover:text-encre">Détails</summary>
            <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <Bloc titre="Butin rune par rune">
                <Butin sim={sim} onVoirPrix={() => aller('prix')} />
              </Bloc>
              <div className="space-y-4">
                <Bloc titre="Paramètres">
                  <ParametresSimu />
                </Bloc>
                <Bloc titre="Bilan">
                  <BilanDetaille sim={sim} />
                </Bloc>
                <Bloc titre="Journal des coefficients">
                  <JournalCoefficients itemId={item.id} />
                </Bloc>
                <Bloc titre="Réglages du moteur">
                  <Reglages />
                </Bloc>
              </div>
            </div>
          </details>
        </>
      )}
    </div>
  );
}
