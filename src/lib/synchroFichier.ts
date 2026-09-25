/**
 * Synchronise le localStorage avec le fichier du projet.
 *
 * Au démarrage : si le fichier contient des données et que ce navigateur n'en a
 * aucune, on les restaure — c'est ce qui sauve la mise après un changement de
 * port ou de navigateur. Ensuite, chaque modification est recopiée dans le
 * fichier, avec un délai pour ne pas écrire à chaque frappe.
 */
import { useCompte } from '../store/compte.ts';
import { useNotes } from '../store/notes.ts';
import { useStorePrix } from '../store/prix.ts';
import { useReglages } from '../store/reglages.ts';
import { useSimu } from '../store/simu.ts';
import { ecrireFichier, lireFichier } from './fichierDonnees.ts';
import { CLES_SAUVEGARDE, exporterTout, importerTout } from './sauvegarde.ts';

const DELAI_ECRITURE = 1500;

export type EtatSynchro = { actif: boolean; restaure: boolean; derniereEcriture: number | null };

let etat: EtatSynchro = { actif: false, restaure: false, derniereEcriture: null };
const abonnes = new Set<(e: EtatSynchro) => void>();

function publier(suivant: Partial<EtatSynchro>) {
  etat = { ...etat, ...suivant };
  for (const a of abonnes) a(etat);
}

export function etatSynchro(): EtatSynchro {
  return etat;
}

export function surSynchro(callback: (e: EtatSynchro) => void): () => void {
  abonnes.add(callback);
  return () => abonnes.delete(callback);
}

function navigateurVide(): boolean {
  return CLES_SAUVEGARDE.every((cle) => {
    try {
      return localStorage.getItem(cle) === null;
    } catch {
      return true;
    }
  });
}

/** À appeler une fois au démarrage, avant que l'utilisateur ne saisisse quoi que ce soit. */
export async function initSynchroFichier(): Promise<void> {
  const lecture = await lireFichier();
  // Point d'entrée absent (build statique) : on reste sur le localStorage.
  if (!lecture.disponible) return;

  let restaure = false;
  const fichier = lecture.sauvegarde;
  if (fichier && Object.keys(fichier.donnees ?? {}).length > 0 && navigateurVide()) {
    importerTout(fichier);
    // Les stores ont déjà lu un localStorage vide : on les relit.
    await Promise.all([
      useStorePrix.persist.rehydrate(),
      useNotes.persist.rehydrate(),
      useSimu.persist.rehydrate(),
      useReglages.persist.rehydrate(),
      useCompte.persist.rehydrate(),
    ]);
    restaure = true;
  }
  publier({ actif: true, restaure });

  let minuteur: ReturnType<typeof setTimeout> | null = null;
  const planifier = () => {
    if (minuteur) clearTimeout(minuteur);
    minuteur = setTimeout(async () => {
      if (await ecrireFichier(exporterTout())) publier({ derniereEcriture: Date.now() });
    }, DELAI_ECRITURE);
  };

  for (const store of [useStorePrix, useNotes, useSimu, useReglages, useCompte]) {
    store.subscribe(planifier);
  }
  // Une première écriture fige l'état courant même si rien ne change ensuite.
  planifier();
}
