import { describe, expect, it } from 'vitest';
import type { Item } from '../data/types.ts';
import { recommanderBrisage, type SourceCout } from './recommandation.ts';
import { contexte } from './fixtures.test-utils.ts';

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

const couts = (...paires: [Item, number, SourceCout?][]) =>
  new Map(paires.map(([i, prix, source]) => [i.id, { prix, source: source ?? ('hdv' as SourceCout) }]));

const OPT = { budget: 100_000, coefficient: 100, taxePct: 0, jet: 'moyen' as const };

describe('recommanderBrisage', () => {
  it('ignore les objets sans coût relevé', () => {
    const a = obj('Sans prix', [{ statId: 'force', min: 50, max: 50 }]);
    expect(recommanderBrisage([a], contexte(), { ...OPT, couts: new Map() })).toEqual([]);
  });

  it('écarte ce qui est à perte', () => {
    const a = obj('Trop cher', [{ statId: 'force', min: 10, max: 10 }]);
    // 10 Force niv 100 → 15 points → 15 runes Fo à 100 = 1 500 kamas, payé 50 000.
    expect(recommanderBrisage([a], contexte('toutSimple'), { ...OPT, couts: couts([a, 50_000]) })).toEqual([]);
  });

  it('calcule bénéfice, ROI et quantité achetable avec le budget', () => {
    const a = obj('Bon', [{ statId: 'force', min: 100, max: 100 }]);
    // 100 Force niv 100 → 150 points + plancher 1 → 151 runes Fo × 100 = 15 100
    const [o] = recommanderBrisage([a], contexte('toutSimple'), { ...OPT, couts: couts([a, 10_000]) });
    expect(o.valeurNette).toBeCloseTo(15_100, 6);
    expect(o.benefice).toBeCloseTo(5_100, 6);
    expect(o.roi).toBeCloseTo(51, 6);
    expect(o.quantite).toBe(10);
    expect(o.beneficeTotal).toBeCloseTo(51_000, 6);
  });

  it('déduit la taxe de vente', () => {
    const a = obj('Bon', [{ statId: 'force', min: 100, max: 100 }]);
    const [o] = recommanderBrisage([a], contexte('toutSimple'), { ...OPT, taxePct: 2, couts: couts([a, 10_000]) });
    expect(o.valeurNette).toBeCloseTo(14_798, 6); // 15 100 × 0,98
  });

  it('classe par gain total du budget, pas par marge unitaire', () => {
    // Le petit rapporte moins par objet mais le budget en permet bien plus.
    const petit = obj('Petit', [{ statId: 'force', min: 100, max: 100 }]);
    const gros = obj('Gros', [{ statId: 'force', min: 400, max: 400 }]);
    const r = recommanderBrisage([petit, gros], contexte('toutSimple'), {
      ...OPT,
      couts: couts([petit, 10_000], [gros, 53_000]),
    });
    expect(r[0].item.nom).toBe('Petit');
    expect(r[0].beneficeTotal).toBeGreaterThan(r[1].beneficeTotal);
    expect(r[1].benefice).toBeGreaterThan(r[0].benefice);
  });

  it('retient le focus quand il rapporte plus que le brisage naturel', () => {
    // Le PA pèse 100 : focaliser dessus draine la moitié du poids de la Sagesse.
    const a = obj('Mixte', [
      { statId: 'sagesse', min: 60, max: 60 },
      { statId: 'pa', min: 1, max: 1 },
    ]);
    const ctx = contexte('toutSimple');
    const [o] = recommanderBrisage([a], ctx, { ...OPT, couts: couts([a, 5_000]) });
    const sansFocus = recommanderBrisage([a], ctx, { ...OPT, couts: couts([a, 5_000]) })[0];
    expect(o.focus).toBe('pa');
    expect(sansFocus.valeurNette).toBeGreaterThan(93_000);
  });

  it('filtre sur la marge minimale exigée', () => {
    const a = obj('Petite marge', [{ statId: 'force', min: 100, max: 100 }]);
    const base = { ...OPT, couts: couts([a, 14_000]) };
    expect(recommanderBrisage([a], contexte('toutSimple'), base)).toHaveLength(1);
    expect(recommanderBrisage([a], contexte('toutSimple'), { ...base, roiMin: 30 })).toEqual([]);
  });

  it('écarte les objets que le concasseur refuse', () => {
    const a = obj('Lié', [{ statId: 'force', min: 100, max: 100 }], 100, { nonBrisable: true });
    expect(recommanderBrisage([a], contexte('toutSimple'), { ...OPT, couts: couts([a, 1_000]) })).toEqual([]);
  });

  it('un budget inférieur au prix donne une quantité nulle', () => {
    const a = obj('Cher', [{ statId: 'force', min: 1000, max: 1000 }]);
    const [o] = recommanderBrisage([a], contexte('toutSimple'), { ...OPT, budget: 5_000, couts: couts([a, 20_000]) });
    expect(o.quantite).toBe(0);
    expect(o.beneficeTotal).toBe(0);
    expect(o.benefice).toBeGreaterThan(0);
  });
});

describe('coefficients relevés', () => {
  const a = obj('Testé', [{ statId: 'force', min: 100, max: 100 }]);

  it('un coefficient relevé prime sur le coefficient supposé', () => {
    const base = { ...OPT, couts: couts([a, 10_000]) };
    const suppose = recommanderBrisage([a], contexte('toutSimple'), base)[0];
    const mesure = recommanderBrisage([a], contexte('toutSimple'), { ...base, coefficients: new Map([[a.id, 200]]) })[0];
    expect(suppose.coefficient).toBe(100);
    expect(suppose.coefMesure).toBe(false);
    expect(mesure.coefficient).toBe(200);
    expect(mesure.coefMesure).toBe(true);
    expect(mesure.valeurNette).toBeCloseTo(suppose.valeurNette * 2, 6);
  });

  it('un objet devient non rentable si son coefficient relevé est bas', () => {
    const base = { ...OPT, couts: couts([a, 10_000]) };
    expect(recommanderBrisage([a], contexte('toutSimple'), base)).toHaveLength(1);
    expect(recommanderBrisage([a], contexte('toutSimple'), { ...base, coefficients: new Map([[a.id, 30]]) })).toEqual([]);
  });

  it('chaque objet garde son propre coefficient', () => {
    const b = obj('Autre', [{ statId: 'force', min: 100, max: 100 }]);
    const r = recommanderBrisage([a, b], contexte('toutSimple'), {
      ...OPT,
      couts: couts([a, 10_000], [b, 10_000]),
      coefficients: new Map([[a.id, 300]]),
    });
    const parNom = Object.fromEntries(r.map((o) => [o.item.nom, o]));
    expect(parNom['Testé'].coefficient).toBe(300);
    expect(parNom['Autre'].coefficient).toBe(100);
    expect(parNom['Testé'].benefice).toBeGreaterThan(parNom['Autre'].benefice);
  });
});
