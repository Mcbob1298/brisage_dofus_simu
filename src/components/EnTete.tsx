import { useCatalogue } from '../store/catalogue.ts';
import { useReglages } from '../store/reglages.ts';
import { useTheme } from '../store/theme.ts';

export type Onglet = 'compte' | 'objet' | 'rune' | 'prix' | 'prixObjets';

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: 'compte', label: 'Mon compte' },
  { id: 'objet', label: 'Brisage' },
  { id: 'rune', label: 'Cibler une rune' },
  { id: 'prix', label: 'Prix des runes' },
  { id: 'prixObjets', label: 'Prix des objets' },
];

const ICONE_THEME = { system: '◐', light: '☀', dark: '☾' } as const;
const LABEL_THEME = { system: 'Thème : système', light: 'Thème : clair', dark: 'Thème : sombre' } as const;

/** Cible runique : marque de l'application. */
function Logo() {
  return (
    <svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true" className="shrink-0">
      <circle cx="32" cy="32" r="29" fill="none" stroke="var(--accent)" strokeWidth="3" />
      <circle cx="32" cy="32" r="20" fill="none" stroke="var(--accent-fort)" strokeWidth="2.5" opacity="0.8" />
      <circle cx="32" cy="32" r="11" fill="var(--accent)" opacity="0.18" />
      <path d="M26 41l6-19 6 19M28.5 34.5h7" fill="none" stroke="var(--accent-fort)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EnTete({ onglet, onChange }: { onglet: Onglet; onChange: (o: Onglet) => void }) {
  const { theme, cycle } = useTheme();
  const serveurs = useCatalogue((s) => s.serveurs);
  const serveur = useReglages((s) => s.serveur);
  const setServeur = useReglages((s) => s.setServeur);

  return (
    <header className="border-b border-bord bg-fond-2/60">
      <div className="mx-auto max-w-6xl px-3">
        {/* Rangée haute : navigation à gauche, thème à droite */}
        <div className="flex items-center gap-1 py-2">
          <nav className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Sections">
            {ONGLETS.map((o) => (
              <button
                key={o.id}
                onClick={() => onChange(o.id)}
                aria-current={onglet === o.id ? 'page' : undefined}
                className={`relative whitespace-nowrap px-3 py-1.5 text-sm transition-colors ${
                  onglet === o.id ? 'font-semibold text-encre' : 'text-encre-2 hover:text-encre'
                }`}
              >
                {o.label}
                {onglet === o.id && <span className="absolute inset-x-2 -bottom-0.5 h-0.5 rounded bg-accent" />}
              </button>
            ))}
          </nav>
          <button
            onClick={cycle}
            title={LABEL_THEME[theme]}
            aria-label={LABEL_THEME[theme]}
            className="h-8 w-8 shrink-0 rounded-full text-encre-2 hover:bg-surface-2 hover:text-encre"
          >
            {ICONE_THEME[theme]}
          </button>
        </div>

        {/* Marque centrée, à la manière d'un en-tête de fansite */}
        <div className="flex flex-col items-center gap-1 pb-3 pt-2">
          <span className="flex items-center gap-3">
            <span
              className="text-3xl font-black tracking-tight text-accent sm:text-4xl"
              style={{ textShadow: '0 0 24px color-mix(in oklab, var(--accent) 45%, transparent)' }}
            >
              Brisage
            </span>
            <Logo />
          </span>
          <span className="flex items-center gap-2 text-xs text-encre-2">
            <label className="flex items-center gap-1.5" title="Les prix que tu relèves sont propres à ton serveur">
              Serveur
              <select value={serveur} onChange={(e) => setServeur(e.target.value)} className="champ h-7 text-xs" aria-label="Serveur de jeu">
                {(serveurs.length ? serveurs.map((s) => s.nom) : [serveur]).map((nom) => (
                  <option key={nom} value={nom}>
                    {nom}
                  </option>
                ))}
              </select>
            </label>
          </span>
        </div>
      </div>
    </header>
  );
}
