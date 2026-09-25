/**
 * Accès au miroir sur disque servi par le plugin Vite (voir
 * vite-plugin-donnees.ts). Absent d'un build statique : tout échec est traité
 * comme « pas de fichier », l'application se contente alors du localStorage.
 */
import type { Sauvegarde } from './sauvegarde.ts';

const ROUTE = '/__donnees';

export async function lireFichier(): Promise<Sauvegarde | null> {
  try {
    const res = await fetch(ROUTE, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const json = (await res.json()) as Partial<Sauvegarde> | null;
    return json && json.format === 'brisage-sauvegarde' ? (json as Sauvegarde) : null;
  } catch {
    return null;
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
