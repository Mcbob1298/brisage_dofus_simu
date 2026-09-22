/** Accès localStorage tolérant (navigation privée, quota, JSON corrompu). */
export function lireLocal<T>(cle: string, defaut: T): T {
  try {
    const raw = localStorage.getItem(cle);
    return raw === null ? defaut : (JSON.parse(raw) as T);
  } catch {
    return defaut;
  }
}

export function ecrireLocal(cle: string, valeur: unknown): void {
  try {
    localStorage.setItem(cle, JSON.stringify(valeur));
  } catch {
    /* quota ou stockage indisponible : on continue sans persistance */
  }
}
