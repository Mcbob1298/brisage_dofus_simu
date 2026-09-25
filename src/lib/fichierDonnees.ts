/**
 * Accès au miroir sur disque servi par le plugin Vite (voir
 * vite-plugin-donnees.ts).
 *
 * On distingue deux situations qu'il ne faut surtout pas confondre : le point
 * d'entrée n'existe pas (build statique) et le fichier n'a pas encore été créé
 * (première utilisation). Dans le second cas la synchronisation doit bel et
 * bien s'activer, sans quoi rien ne serait jamais écrit.
 */
import type { Sauvegarde } from './sauvegarde.ts';

const ROUTE = '/__donnees';

export type LectureFichier =
  | { disponible: false }
  | { disponible: true; sauvegarde: Sauvegarde | null };

export async function lireFichier(): Promise<LectureFichier> {
  try {
    const res = await fetch(ROUTE, { headers: { accept: 'application/json' } });
    if (!res.ok) return { disponible: false };
    // Un hébergeur statique renvoie l'index.html en repli : le parsing échoue,
    // et le catch tranche correctement.
    const json = (await res.json()) as Partial<Sauvegarde> | null;
    const sauvegarde = json && json.format === 'brisage-sauvegarde' ? (json as Sauvegarde) : null;
    return { disponible: true, sauvegarde };
  } catch {
    return { disponible: false };
  }
}

/** Écrit le fichier ; retourne `false` si le point d'entrée n'existe pas. */
export async function ecrireFichier(contenu: Sauvegarde): Promise<boolean> {
  try {
    const res = await fetch(ROUTE, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(contenu),
    });
    return res.ok;
  } catch {
    return false;
  }
}
