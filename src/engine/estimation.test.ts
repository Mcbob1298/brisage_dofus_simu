import { describe, expect, it } from 'vitest';
import type { Item } from '../data/types.ts';
import { calibrer, estimerPrix, mediane, MIN_RELEVES } from './estimation.ts';

const item = (niveau: number, type = 'Anneau'): Item => ({
  id: 1,
  nom: 'x',
  niveau,
  type,
  famille: 'Équipement',
  imageLocale: '',
  stats: [],
});

describe('mediane', () => {
  it('prend la valeur centrale, moyenne des deux centrales si pair', () => {
    expect(mediane([3, 1, 2])).toBe(2);
    expect(mediane([1, 2, 3, 4])).toBe(2.5);
    expect(mediane([])).toBeNull();
  });
});

describe('calibrer', () => {
  it('refuse d’estimer en dessous du minimum de relevés', () => {
    const c = calibrer([{ niveau: 100, type: 'Anneau', prix: 10_000 }]);
    expect(c.parNiveau).toBeNull();
    expect(c.nbReleves).toBe(1);
    expect(estimerPrix(item(50), c)).toBeNull();
  });

  it('déduit un prix au niveau à partir de plusieurs relevés', () => {
    const c = calibrer([
      { niveau: 100, type: 'Anneau', prix: 10_000 },
      { niveau: 50, type: 'Cape', prix: 5_000 },
      { niveau: 200, type: 'Coiffe', prix: 20_000 },
    ]);
    expect(c.parNiveau).toBe(100);
    expect(estimerPrix(item(60), c)).toEqual({ prix: 6_000, source: 'global' });
  });

  it('résiste à un prix aberrant grâce à la médiane', () => {
    const c = calibrer([
      { niveau: 100, type: 'Anneau', prix: 10_000 },
      { niveau: 100, type: 'Cape', prix: 11_000 },
      { niveau: 100, type: 'Coiffe', prix: 9_000 },
      { niveau: 100, type: 'Bottes', prix: 5_000_000 },
    ]);
    expect(c.parNiveau).toBeCloseTo(105, 6);
  });

  it('affine par type quand les relevés du type suffisent', () => {
    const c = calibrer([
      { niveau: 100, type: 'Bouclier', prix: 50_000 },
      { niveau: 200, type: 'Bouclier', prix: 100_000 },
      { niveau: 50, type: 'Bouclier', prix: 25_000 },
      { niveau: 100, type: 'Anneau', prix: 10_000 },
      { niveau: 100, type: 'Cape', prix: 10_000 },
      { niveau: 100, type: 'Coiffe', prix: 10_000 },
    ]);
    expect(c.parType.get('Bouclier')).toBe(500);
    expect(estimerPrix(item(100, 'Bouclier'), c)).toEqual({ prix: 50_000, source: 'type' });
    // un type sans assez de relevés retombe sur la médiane globale
    expect(estimerPrix(item(100, 'Amulette'), c)?.source).toBe('global');
  });

  it('ignore les relevés inutilisables', () => {
    const c = calibrer([
      { niveau: 0, type: 'Anneau', prix: 10_000 },
      { niveau: 100, type: 'Anneau', prix: 0 },
      { niveau: 100, type: 'Cape', prix: 10_000 },
    ]);
    expect(c.nbReleves).toBe(1);
    expect(MIN_RELEVES).toBe(3);
  });
});
