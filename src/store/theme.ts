import { create } from 'zustand';
import { ecrireLocal, lireLocal } from '../lib/storage.ts';

export type Theme = 'system' | 'light' | 'dark';
const CLE = 'brisage.theme';

function appliquer(theme: Theme) {
  const sombre = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', sombre);
  document.documentElement.style.colorScheme = sombre ? 'dark' : 'light';
}

type EtatTheme = { theme: Theme; setTheme: (t: Theme) => void; cycle: () => void };

export const useTheme = create<EtatTheme>((set, get) => ({
  theme: lireLocal<Theme>(CLE, 'system'),
  setTheme: (theme) => {
    ecrireLocal(CLE, theme);
    appliquer(theme);
    set({ theme });
  },
  cycle: () => {
    const ordre: Theme[] = ['system', 'light', 'dark'];
    get().setTheme(ordre[(ordre.indexOf(get().theme) + 1) % ordre.length]);
  },
}));

/** À appeler une fois au démarrage : applique le thème et suit le réglage système. */
export function initTheme() {
  appliquer(useTheme.getState().theme);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useTheme.getState().theme === 'system') appliquer('system');
  });
}
