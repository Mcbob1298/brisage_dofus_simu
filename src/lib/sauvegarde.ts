/**
 * Sauvegarde complète de ce que l'app garde dans le navigateur.
 *
 * Le `localStorage` est lié à l'origine (protocole + hôte + port) : changer de
 * port, de machine ou de navigateur fait disparaître les données. Cet export
 * permet de les déplacer.
 */
export const CLES_SAUVEGARDE = [
  'brisage.prix',
  'brisage.notes',
  'brisage.guide',
  'brisage.simu',
  'brisage.reglages',
  'brisage.theme',
] as const;

export type Sauvegarde = {
  format: 'brisage-sauvegarde';
  version: 1;
  exporteLe: string;
  donnees: Record<string, string>;
};

export function exporterTout(): Sauvegarde {
  const donnees: Record<string, string> = {};
  for (const cle of CLES_SAUVEGARDE) {
    try {
      const v = localStorage.getItem(cle);
      if (v !== null) donnees[cle] = v;
    } catch {
      /* stockage indisponible : on exporte ce qu'on peut */
    }
  }
  return { format: 'brisage-sauvegarde', version: 1, exporteLe: new Date().toISOString(), donnees };
}

/** Restaure une sauvegarde et retourne le nombre de clés écrites. Recharger ensuite. */
export function importerTout(json: unknown): number {
  const s = json as Partial<Sauvegarde>;
  if (!s || s.format !== 'brisage-sauvegarde' || typeof s.donnees !== 'object' || s.donnees === null) {
    throw new Error('Fichier non reconnu (attendu : sauvegarde « brisage-sauvegarde »).');
  }
  let n = 0;
  for (const [cle, valeur] of Object.entries(s.donnees)) {
    if (!(CLES_SAUVEGARDE as readonly string[]).includes(cle) || typeof valeur !== 'string') continue;
    try {
      localStorage.setItem(cle, valeur);
      n++;
    } catch {
      /* quota : on continue */
    }
  }
  return n;
}
