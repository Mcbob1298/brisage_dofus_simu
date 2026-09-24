import { useRef, useState } from 'react';
import { exporterTout, importerTout } from '../lib/sauvegarde.ts';

/** Export / import de toutes les données locales (prix, relevés, guide, réglages). */
export function Sauvegarde() {
  const fichierRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);

  const telecharger = () => {
    const blob = new Blob([JSON.stringify(exporterTout(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `brisage-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setMessage('Sauvegarde téléchargée.');
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
    <div className="flex flex-wrap items-center gap-2 text-xs text-encre-2">
      <span className="titre-section">Sauvegarde complète</span>
      <button onClick={telecharger} className="btn btn-petit">
        Tout exporter
      </button>
      <button onClick={() => fichierRef.current?.click()} className="btn btn-petit">
        Tout restaurer
      </button>
      <input ref={fichierRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void charger(e.target.files?.[0])} />
      <span>
        Prix, relevés, journal, guide et réglages. Les données sont liées à l'adresse du site (
        <code>{location.host}</code>) : garde ce fichier avant de changer de port ou de navigateur.
      </span>
      {message && <span className="text-info">{message}</span>}
    </div>
  );
}
