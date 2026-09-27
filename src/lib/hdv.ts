/**
 * Lecture des relevés de l'Hôtel de Vente.
 *
 * Le jeu vend par lots de 1, 10 ou 100, et le lot de 10 est souvent moins cher
 * à l'unité que le lot de 1. On retient donc le meilleur prix unitaire, mais on
 * retient AUSSI combien d'exemplaires sont réellement en vente à ce prix : un
 * prix sans disponibilité conduit à conseiller d'acheter un stock qui n'existe
 * pas.
 */
import type { EntreeHdv, PrixHdv } from '../data/types.ts';

export type OffreHdv = {
  /** Meilleur prix unitaire, toutes tailles de lot confondues. */
  prixUnitaire: number;
  /** Taille du lot qui donne ce prix (1, 10, 100…). */
  taille: number;
  /**
   * Exemplaires en vente À CE PRIX. `null` si la source ne donne pas les
   * quantités — on ne suppose alors rien, ni abondance ni pénurie.
   */
  disponible: number | null;
  /** Exemplaires en vente toutes offres confondues, prix plus élevés compris. */
  disponibleTotal: number | null;
  releveLe: string | null;
};

/** Normalise une entrée du fichier en une offre exploitable, `null` si inutilisable. */
export function offreHdv(entree: EntreeHdv | undefined): OffreHdv | null {
  if (entree === undefined) return null;
  if (typeof entree === 'number') {
    return Number.isFinite(entree) && entree > 0
      ? { prixUnitaire: entree, taille: 1, disponible: null, disponibleTotal: null, releveLe: null }
      : null;
  }

  let meilleur: OffreHdv | null = null;
  let total = 0;
  let totalConnu = false;
  for (const lot of entree.lots ?? []) {
    if (!(lot.taille >= 1) || !(lot.prixDuLot > 0) || !Number.isFinite(lot.prixDuLot)) continue;
    const prixUnitaire = lot.prixDuLot / lot.taille;
    const dispo = lot.quantiteEnVente !== undefined && lot.quantiteEnVente >= 0 ? lot.quantiteEnVente * lot.taille : null;
    if (dispo !== null) {
      total += dispo;
      totalConnu = true;
    }
    if (meilleur === null || prixUnitaire < meilleur.prixUnitaire) {
      meilleur = { prixUnitaire, taille: lot.taille, disponible: dispo, disponibleTotal: null, releveLe: entree.releveLe ?? null };
    }
  }
  if (meilleur === null) return null;
  return { ...meilleur, disponibleTotal: totalConnu ? total : null };
}

/** Le fichier est-il exploitable, et pour le bon serveur ? */
export function hdvUtilisable(fichier: PrixHdv | null, serveur: string | null): boolean {
  if (!fichier || fichier.format !== 'brisage-prix-hdv') return false;
  // Comparer des prix d'un autre serveur serait pire que ne rien afficher.
  return serveur === null || fichier.serveur === serveur;
}

/** Toutes les offres du fichier, indexées par id d'objet. */
export function indexerHdv(fichier: PrixHdv | null): Map<number, OffreHdv> {
  const out = new Map<number, OffreHdv>();
  if (!fichier?.prix) return out;
  for (const [cle, entree] of Object.entries(fichier.prix)) {
    const id = Number(cle);
    if (!Number.isInteger(id)) continue;
    const offre = offreHdv(entree);
    if (offre) out.set(id, offre);
  }
  return out;
}
