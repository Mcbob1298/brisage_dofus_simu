import { describe, expect, it } from 'vitest';
import { planifier } from './plan.ts';

describe('planifier', () => {
  it('objectif déjà atteint → 0 cycle', () => {
    const p = planifier(1_000_000, 500_000, 10_000, 1_000);
    expect(p.cycles).toBe(0);
    expect(p.restant).toBe(0);
  });

  it('capital insuffisant pour un objet → inatteignable', () => {
    const p = planifier(5_000, 100_000, 10_000, 1_000);
    expect(p.cycles).toBeNull();
    expect(p.objetsPremierCycle).toBe(0);
  });

  it('bénéfice nul ou négatif → inatteignable', () => {
    expect(planifier(100_000, 200_000, 10_000, 0).cycles).toBeNull();
    expect(planifier(100_000, 200_000, 10_000, -50).cycles).toBeNull();
  });

  it('réinvestit le capital à chaque cycle', () => {
    // 100k, objets à 10k rapportant 5k : cycle 1 → 10 objets, +50k → 150k ;
    // cycle 2 → 15 objets, +75k → 225k ≥ 200k.
    const p = planifier(100_000, 200_000, 10_000, 5_000);
    expect(p.objetsPremierCycle).toBe(10);
    expect(p.gainPremierCycle).toBe(50_000);
    expect(p.cycles).toBe(2);
    expect(p.objetsTotal).toBe(25);
    expect(p.restant).toBe(100_000);
  });

  it('plafonne le nombre de cycles', () => {
    const p = planifier(10_000, 1e15, 10_000, 1);
    expect(p.cycles).toBeNull();
  });
});
