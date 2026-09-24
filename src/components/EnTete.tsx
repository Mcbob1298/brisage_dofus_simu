import { useTheme } from '../store/theme.ts';

export type Onglet = 'guide' | 'objet' | 'rune' | 'prix' | 'comparateur' | 'explorateur';

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: 'guide', label: 'Guide' },
  { id: 'objet', label: 'Objet' },
  { id: 'rune', label: 'Cibler une rune' },
  { id: 'prix', label: 'Prix des runes' },
  { id: 'comparateur', label: 'Comparateur' },
  { id: 'explorateur', label: 'Explorateur' },
];

const ICONE_THEME = { system: '◐', light: '☀', dark: '☾' } as const;
const LABEL_THEME = { system: 'Thème : système', light: 'Thème : clair', dark: 'Thème : sombre' } as const;

/** Marque : une pierre runique stylisée. */
function Logo() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" className="shrink-0">
      <path d="M12 2l8.5 5v10L12 22l-8.5-5V7z" fill="var(--accent)" />
      <path d="M12 5l5.5 3.2v6.6L12 18l-5.5-3.2V8.2z" fill="#fff" fillOpacity={0.18} />
      <path d="M9.2 15.5L12 8l2.8 7.5M10.2 13h3.6" fill="none" stroke="#fff" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EnTete({ onglet, onChange }: { onglet: Onglet; onChange: (o: Onglet) => void }) {
  const { theme, cycle } = useTheme();
  return (
    <header className="border-b border-bord bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2">
        <span className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-bold tracking-tight">Brisage</span>
        </span>
        <nav className="flex gap-1 overflow-x-auto [scrollbar-width:none]" aria-label="Sections">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              aria-current={onglet === o.id ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-sm transition-colors ${
                onglet === o.id ? 'bg-accent font-medium text-white' : 'text-encre-2 hover:bg-surface-2 hover:text-encre'
              }`}
            >
              {o.label}
            </button>
          ))}
        </nav>
        <button
          onClick={cycle}
          title={LABEL_THEME[theme]}
          aria-label={LABEL_THEME[theme]}
          className="ml-auto h-8 w-8 rounded-full text-encre-2 hover:bg-surface-2 hover:text-encre"
        >
          {ICONE_THEME[theme]}
        </button>
      </div>
    </header>
  );
}
