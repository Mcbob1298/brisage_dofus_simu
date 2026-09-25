import { useEffect, useRef, useState } from 'react';
import { CHEMIN_DONNEES } from '../lib/cheminDonnees.ts';
import { exporterTout, importerTout } from '../lib/sauvegarde.ts';
import { etatSynchro, surSynchro, type EtatSynchro } from '../lib/synchroFichier.ts';

/** Sauvegarde : miroir automatique dans le projet, plus export/import manuels. */
export function Sauvegarde() {
  const fichierRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [synchro, setSynchro] = useState<EtatSynchro>(etatSynchro);

  useEffect(() => surSynchro(setSynchro), []);

  const telecharger = () => {
    const blob = new Blob([JSON.stringify(exporterTout(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `brisage-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage('Copie téléchargée.');
  };

  const charger = async (f: File | undefined) => {
    if (!f) return;
    try {
      const n = importerTout(JSON.parse(await f.text()));
      setMessage(`${n} jeu(x) de données restauré(s). Rechargement…`);
      setTimeout(() => location.reload(), 600);
    } catch (e) {
      setMessage(`Restauration impossible : ${(e as Error).message}`);
    }
    if (fichierRef.current) fichierRef.current.value = '';
  };

  return (
    <div className="space-y-2 text-xs text-encre-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="titre-section">Sauvegarde</span>
        {synchro.actif ? (
          <span className="badge bg-ok-doux text-ok" title={`Écrit dans ${CHEMIN_DONNEES}, à la racine du projet`}>
            ✓ automatique dans <code>{CHEMIN_DONNEES}</code>
            {synchro.derniereEcriture !== null && ' · à jour'}
          </span>
        ) : (
          <span className="badge bg-alerte-doux text-alerte" title="Le miroir sur disque n'existe que via npm run dev ou npm run preview">
            hors ligne — données dans ce navigateur uniquement
          </span>
        )}
        <button onClick={telecharger} className="btn btn-petit">
          Exporter une copie
        </button>
        <button onClick={() => fichierRef.current?.click()} className="btn btn-petit">
          Restaurer un fichier
        </button>
        <input ref={fichierRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void charger(e.target.files?.[0])} />
        {message && <span className="text-info">{message}</span>}
      </div>
      <p>
        {synchro.actif ? (
          <>
            Tes prix et relevés sont recopiés dans <code>{CHEMIN_DONNEES}</code> à chaque modification : ils survivent à un changement de port, de navigateur, et
            se récupèrent dans l'historique git. {synchro.restaure && <strong>Ce navigateur était vide : les données du fichier ont été restaurées.</strong>}
          </>
        ) : (
          <>
            Le miroir sur disque n'existe qu'avec <code>npm run dev</code>. Ici, tout vit dans le navigateur (<code>{location.host}</code>) : exporte une copie
            avant de changer de port ou de machine.
          </>
        )}
      </p>
    </div>
  );
}
