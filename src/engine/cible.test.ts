import { describe, expect, it } from 'vitest';
import type { Item, Monstre } from '../data/types.ts';
import { ciblerRune, indexerDrops } from './cible.ts';
import { contexte, runeParNom } from './fixtures.test-utils.ts';

let id = 1;
const obj = (nom: string, stats: Item['stats'], niveau = 100, extra: Partial<Item> = {}): Item => ({
  id: id++,
  nom,
  niveau,
  type: 'Anneau',
  famille: 'Équipement',
  imageLocale: '',
  stats,
  ...extra,
});

const OPT = { coefficient: 100, jet: 'max' as const };

describe('ciblerRune', () => {
  it('ne retient que les objets portant la caractéristique de la rune', () => {
    const avec = obj('Avec PA', [{ statId: 'pa', min: 1, max: 1 }]);
    const sans = obj('Sans', [{ statId: 'force', min: 50, max: 50 }]);
    const r = ciblerRune(runeParNom('Rune Ga Pa'), [avec, sans], contexte(), OPT);
    expect(r.map((p) => p.item.nom)).toEqual(['Avec PA']);
  });

  it('le focus rapporte plus que le brisage naturel quand l’objet a d’autres lignes', () => {
    const item = obj('Mixte', [
      { statId: 'pa', min: 1, max: 1 },
      { statId: 'vitalite', min: 100, max: 100 },
    ]);
    const [p] = ciblerRune(runeParNom('Rune Ga Pa'), [item], contexte(), OPT);
    expect(p.pointsFocus).toBeGreaterThan(p.pointsNaturel);
    // focus : (1×100 + 100×0,25 / 2) × 100 × 0,015 ÷ 100 = 1,6875 point
    expect(p.pointsFocus).toBeCloseTo(1.6875, 6);
    expect(p.pointsNaturel).toBeCloseTo(1.5, 6);
  });

  it('convertit les points en runes selon la valeur de la rune visée', () => {
    const item = obj('Vitalité', [{ statId: 'vitalite', min: 400, max: 400 }]);
    // 400 × 100 × 0,015 = 600 points ; Rune Ra Vi = 50 points → 12 runes
    const [ra] = ciblerRune(runeParNom('Rune Ra Vi'), [item], contexte(), OPT);
    const [simple] = ciblerRune(runeParNom('Rune Vi'), [item], contexte(), OPT);
    expect(ra.quantiteFocus).toBeCloseTo(12, 6);
    expect(simple.quantiteFocus).toBeCloseTo(120, 6);
  });

  it('calcule le coût de revient d’une rune', () => {
    const item = obj('Anneau', [{ statId: 'pa', min: 1, max: 1 }]);
    const [p] = ciblerRune(runeParNom('Rune Ga Pa'), [item], contexte(), { ...OPT, couts: { [item.id]: 30_000 } });
    expect(p.cout).toBe(30_000);
    expect(p.coutParRune).toBeCloseTo(30_000 / p.quantiteFocus, 6);
  });

  it('laisse le coût à null quand le prix n’est pas connu', () => {
    const item = obj('Anneau', [{ statId: 'pa', min: 1, max: 1 }]);
    const [p] = ciblerRune(runeParNom('Rune Ga Pa'), [item], contexte(), OPT);
    expect(p.cout).toBeNull();
    expect(p.coutParRune).toBeNull();
  });

  it('classe du plus généreux au moins généreux et filtre par niveau', () => {
    const petit = obj('Petit', [{ statId: 'pa', min: 1, max: 1 }], 50);
    const gros = obj('Gros', [{ statId: 'pa', min: 1, max: 1 }], 200);
    const ctx = contexte();
    expect(ciblerRune(runeParNom('Rune Ga Pa'), [petit, gros], ctx, OPT).map((p) => p.item.nom)).toEqual(['Gros', 'Petit']);
    expect(ciblerRune(runeParNom('Rune Ga Pa'), [petit, gros], ctx, { ...OPT, niveauMax: 100 }).map((p) => p.item.nom)).toEqual(['Petit']);
  });

  it('écarte les objets que le concasseur refuse', () => {
    const lie = obj('Katana', [{ statId: 'pa', min: 1, max: 1 }], 120, { nonBrisable: true });
    expect(ciblerRune(runeParNom('Rune Ga Pa'), [lie], contexte(), OPT)).toEqual([]);
  });

  it('remonte les monstres qui lâchent l’objet', () => {
    const item = obj('Anneau', [{ statId: 'pa', min: 1, max: 1 }]);
    const monstre: Monstre = {
      id: 5,
      nom: 'Bouftou',
      niveau: 20,
      niveauMax: 25,
      boss: false,
      archimonstre: false,
      zones: ['Amakna'],
      drops: [{ itemId: item.id, taux: 2 }],
    };
    const [p] = ciblerRune(runeParNom('Rune Ga Pa'), [item], contexte(), OPT, [monstre]);
    expect(p.drops).toEqual([{ monstre, taux: 2 }]);
  });
});

describe('indexerDrops', () => {
  const monstre = (id: number, taux: number): Monstre => ({
    id,
    nom: `M${id}`,
    niveau: 10,
    niveauMax: 10,
    boss: false,
    archimonstre: false,
    zones: [],
    drops: [{ itemId: 42, taux }],
  });

  it('classe les sources par taux décroissant et applique la prospection', () => {
    const idx = indexerDrops([monstre(1, 1), monstre(2, 5)], 200);
    expect(idx.get(42)!.map((d) => [d.monstre.id, d.taux])).toEqual([
      [2, 10],
      [1, 2],
    ]);
  });

  it('plafonne le taux à 100 %', () => {
    expect(indexerDrops([monstre(1, 60)], 500).get(42)![0].taux).toBe(100);
  });
});
