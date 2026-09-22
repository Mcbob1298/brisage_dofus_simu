import { useTheme } from '../store/theme.ts';

export type Onglet = 'objet' | 'prix' | 'comparateur' | 'explorateur';

const ONGLETS: { id: Onglet; label: string }[] = [
  { id: 'objet', label: 'Objet' },
  { id: 'prix', label: 'Prix des runes' },
  { id: 'comparateur', label: 'Comparateur' },
  { id: 'explorateur', label: 'Explorateur' },
];

const ICONE_THEME = { system: '◐', light: '☀', dark: '☾' } as const;
const LABEL_THEME = { system: 'Thème : système', light: 'Thème : clair', dark: 'Thème : sombre' } as const;

export function EnTete({ onglet, onChange }: { onglet: Onglet; onChange: (o: Onglet) => void }) {
  const { theme, cycle } = useTheme();
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-1.5">
        <span className="mr-2 text-sm font-semibold tracking-tight">Brisage</span>
        <nav className="flex gap-0.5 overflow-x-auto [scrollbar-width:none]">
          {ONGLETS.map((o) => (
            <button
              key={o.id}
              onClick={() => onChange(o.id)}
              className={`rounded px-2.5 py-1 text-sm whitespace-nowrap ${
                onglet === o.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
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
          className="ml-auto h-7 w-7 rounded text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          {ICONE_THEME[theme]}
        </button>
      </div>
    </header>
  );
}
