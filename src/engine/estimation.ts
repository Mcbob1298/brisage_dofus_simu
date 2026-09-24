/**
 * Estimation du prix d'un équipement.
 *
 * Aucune API ne donne les prix de l'hôtel des ventes : ils dépendent du serveur
 * et du moment, les sites communautaires reposent sur des saisies de joueurs
 * sans accès programmatique, et la collecte automatisée depuis le client est
 * interdite par Ankama.
 *
 * On se rabat donc sur les prix que l'utilisateur a relevés lui-même : on en
 * déduit un prix au niveau (médiane, robuste aux valeurs extrêmes), affiné par
 * type d'objet quand il y a assez de relevés. C'est un ordre de grandeur, pas
 * une cote — l'interface le présente comme tel.
 */
import type { Item } from '../data/types.ts';

export type Releve = { niveau: number; type: string; prix: number };

export type Calibration = {
  /** Kamas par niveau, toutes catégories confondues (médiane). */
  parNiveau: number | null;
  /** Kamas par niveau, par type d'objet, quand les relevés suffisent. */
  parType: Map<string, number>;
  /** Nombre de relevés exploités. */
  nbReleves: number;
};

/** Relevés minimum avant d'oser une estimation, globale puis par type. */
export const MIN_RELEVES = 3;
export const MIN_RELEVES_TYPE = 3;

export function mediane(valeurs: readonly number[]): number | null {
  if (valeurs.length === 0) return null;
  const tri = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[milieu] : (tri[milieu - 1] + tri[milieu]) / 2;
}

export function calibrer(releves: readonly Releve[]): Calibration {
  const utiles = releves.filter((r) => r.prix > 0 && r.niveau > 0);
  const ratios = utiles.map((r) => r.prix / r.niveau);
  const parType = new Map<string, number>();
  const groupes = new Map<string, number[]>();
  for (const r of utiles) {
    const l = groupes.get(r.type) ?? [];
    l.push(r.prix / r.niveau);
    groupes.set(r.type, l);
  }
  for (const [type, l] of groupes) {
    if (l.length >= MIN_RELEVES_TYPE) {
      const m = mediane(l);
      if (m !== null) parType.set(type, m);
    }
  }
  return {
    parNiveau: utiles.length >= MIN_RELEVES ? mediane(ratios) : null,
    parType,
    nbReleves: utiles.length,
  };
}

export type Estimation = { prix: number; source: 'type' | 'global' };

/** Prix estimé d'un objet, ou `null` si les relevés ne permettent rien de sérieux. */
export function estimerPrix(item: Item, calibration: Calibration): Estimation | null {
  const parType = calibration.parType.get(item.type);
  if (parType !== undefined) return { prix: Math.round(parType * item.niveau), source: 'type' };
  if (calibration.parNiveau !== null) return { prix: Math.round(calibration.parNiveau * item.niveau), source: 'global' };
  return null;
}
