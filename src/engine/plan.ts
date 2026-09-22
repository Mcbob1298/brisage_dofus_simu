/**
 * Plan de progression vers un objectif de kamas : à chaque cycle on achète
 * autant d'objets que le capital le permet, on les brise, on réinvestit.
 * Hypothèse simplificatrice assumée : bénéfice constant par objet — en pratique
 * le coefficient baisse à mesure qu'on brise, d'où l'invitation à re-noter le
 * coefficient après chaque session.
 */
export type Plan = {
  /** Objets à briser au premier cycle (0 si le capital ne couvre pas un objet). */
  objetsPremierCycle: number;
  gainPremierCycle: number;
  /** Nombre de cycles pour atteindre l'objectif, `null` si inatteignable (bénéfice ≤ 0 ou capital < prix). */
  cycles: number | null;
  /** Objets brisés au total sur le plan. */
  objetsTotal: number;
  /** Kamas manquants aujourd'hui (0 si l'objectif est déjà atteint). */
  restant: number;
};

export const MAX_CYCLES = 500;

export function planifier(kamas: number, objectif: number, prixObjet: number, beneficeParObjet: number): Plan {
  const restant = Math.max(0, objectif - kamas);
  const premier = prixObjet > 0 ? Math.floor(kamas / prixObjet) : 0;
  const base: Plan = {
    objetsPremierCycle: premier,
    gainPremierCycle: premier * beneficeParObjet,
    cycles: null,
    objetsTotal: 0,
    restant,
  };
  if (restant === 0) return { ...base, cycles: 0 };
  if (beneficeParObjet <= 0 || premier === 0) return base;

  let capital = kamas;
  let objets = 0;
  for (let cycle = 1; cycle <= MAX_CYCLES; cycle++) {
    const n = Math.floor(capital / prixObjet);
    if (n === 0) return base;
    objets += n;
    capital += n * beneficeParObjet;
    if (capital >= objectif) return { ...base, cycles: cycle, objetsTotal: objets };
  }
  return base;
}
