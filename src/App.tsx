import { useEffect, useState } from 'react';
import { EnTete, type Onglet } from './components/EnTete.tsx';
import { PageObjet } from './pages/PageObjet.tsx';
import { PageRune } from './pages/PageRune.tsx';
import { PagePrix } from './pages/PagePrix.tsx';
import { PagePrixObjets } from './pages/PagePrixObjets.tsx';
import { useCatalogue } from './store/catalogue.ts';
import { initTheme } from './store/theme.ts';
import { useSimulation } from './hooks/useSimulation.ts';

const ONGLETS: Onglet[] = ['objet', 'rune', 'prix', 'prixObjets'];

function ongletDepuisHash(): Onglet {
  const h = location.hash.replace('#', '') as Onglet;
  return ONGLETS.includes(h) ? h : 'objet';
}

export default function App() {
  const [onglet, setOnglet] = useState<Onglet>(ongletDepuisHash);
  const charger = useCatalogue((s) => s.charger);
  const sim = useSimulation();

  useEffect(() => {
    initTheme();
    void charger();
    const onHash = () => setOnglet(ongletDepuisHash());
    addEventListener('hashchange', onHash);
    return () => removeEventListener('hashchange', onHash);
  }, [charger]);

  const changerOnglet = (o: Onglet) => {
    location.hash = o;
    setOnglet(o);
    scrollTo({ top: 0 });
  };

  return (
    <div className="min-h-screen text-encre">
      <EnTete onglet={onglet} onChange={changerOnglet} />
      <main className="mx-auto max-w-6xl px-3 py-4">
        {onglet === 'objet' && <PageObjet sim={sim} aller={changerOnglet} />}
        {onglet === 'rune' && <PageRune aller={changerOnglet} />}
        {onglet === 'prix' && <PagePrix />}
        {onglet === 'prixObjets' && <PagePrixObjets aller={changerOnglet} />}
      </main>
    </div>
  );
}
