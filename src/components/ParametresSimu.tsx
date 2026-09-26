import { useSimu } from '../store/simu.ts';
import { useCoefObjet } from '../hooks/useCoefficients.ts';
import { ChampNombre } from './ChampNombre.tsx';

function Champ({ label, children, aide }: { label: string; children: React.ReactNode; aide?: string }) {
  return (
    <label className="flex flex-col gap-0.5 text-xs text-encre-2">
      <span title={aide}>{label}</span>
      {children}
    </label>
  );
}

/** Coefficient, prix de revient, taille du lot, taxe de vente. */
export function ParametresSimu() {
  const { itemId, prixRevient, nbObjets, taxePct, setChamp } = useSimu();
  // Même valeur que sur la carte : c'est le relevé de l'objet, pas un réglage.
  const { coef, setCoef } = useCoefObjet(itemId);
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-4">
      <Champ label="Coefficient" aide="Coefficient lu au concasseur pour cet objet (enregistré au journal)">
        <ChampNombre value={coef} onChange={(v) => setCoef(Math.max(1, v ?? 100))} suffixe="%" decimales={1} />
      </Champ>
      <Champ label="Prix de revient (kamas)" aide="Coût d'achat ou de craft d'un objet">
        <ChampNombre value={prixRevient} onChange={(v) => setChamp('prixRevient', Math.max(0, v ?? 0))} />
      </Champ>
      <Champ label="Nombre d'objets" aide="Taille du lot : au-delà de 1, le bilan utilise l'espérance">
        <ChampNombre value={nbObjets} onChange={(v) => setChamp('nbObjets', Math.max(1, Math.round(v ?? 1)))} />
      </Champ>
      <Champ label="Taxe de vente" aide="Taxe prélevée sur la vente des runes">
        <ChampNombre value={taxePct} onChange={(v) => setChamp('taxePct', Math.min(100, Math.max(0, v ?? 0)))} suffixe="%" decimales={1} />
      </Champ>
    </div>
  );
}
