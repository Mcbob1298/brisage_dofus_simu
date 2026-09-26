import { describe, expect, it } from 'vitest';
import type { Item } from '../data/types.ts';
import { recommanderBrisage, type SourceCout } from './recommandation.ts';
import { comparerFocus } from './brisage.ts';
import { lignesDepuisItem } from './explorateur.ts';
import { contexte, prixTest } from './fixtures.test-utils.ts';

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

  it('écarte un objet rentable mais hors budget : on ne conseille pas un achat impossible', () => {
    const a = obj('Cher', [{ statId: 'force', min: 1000, max: 1000 }]);
    expect(recommanderBrisage([a], contexte('toutSimple'), { ...OPT, budget: 5_000, couts: couts([a, 20_000]) })).toEqual([]);
  });
});

describe('recommanderBrisage — premier lot', () => {
  // Le coefficient baisse à chaque brisage : on n'engage pas tout le budget sur
  // une mesure faite avant le premier coup.
  it('borne le premier lot à la part de budget qu’on accepte de risquer', () => {
    const a = obj('Pas cher', [{ statId: 'force', min: 100, max: 100 }]);
    const [o] = recommanderBrisage([a], contexte('toutSimple'), {
      ...OPT,
      budget: 100_000,
      partRisquePct: 5,
      couts: couts([a, 1_000]),
    });
    expect(o.quantite).toBe(100); // tout le budget
    expect(o.lotTest).toBe(5); // 5 % de 100 000, soit 5 000 ÷ 1 000
    expect(o.coutLot).toBe(5_000);
    expect(o.beneficeLot).toBeCloseTo(5 * o.benefice, 6);
    // Le plafond budget entier reste calculé, mais ce n'est pas la consigne.
    expect(o.beneficeTotal).toBeCloseTo(100 * o.benefice, 6);
  });

  it('conseille au moins un exemplaire même si un seul dépasse la part risquée', () => {
    const a = obj('Gros', [{ statId: 'force', min: 1000, max: 1000 }]);
    const [o] = recommanderBrisage([a], contexte('toutSimple'), {
      ...OPT,
      budget: 100_000,
      partRisquePct: 1, // 1 000 kamas, soit moins qu'un exemplaire
      couts: couts([a, 20_000]),
    });
    expect(o.lotTest).toBe(1);
    expect(o.coutLot).toBe(20_000);
  });

  it('le gain budget entier reste un plafond, très au-dessus du premier lot', () => {
    const a = obj('Pas cher', [{ statId: 'force', min: 100, max: 100 }]);
    const [o] = recommanderBrisage([a], contexte('toutSimple'), {
      ...OPT,
      budget: 100_000,
      partRisquePct: 5,
      couts: couts([a, 1_000]),
    });
    // 20× l'écart entre ce qu'on conseille et ce que le budget permettrait :
    // c'est précisément l'écart que l'interface doit rendre visible.
    expect(o.beneficeTotal / o.beneficeLot).toBeCloseTo(20, 6);
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

/**
 * Le simulateur et « Mon compte » doivent répondre à la même question.
 *
 * Ils divergeaient : sur un seul exemplaire, `calculerBilan` retenait la vue
 * « garanti » (runes entières), donc la carte annonçait −100 % de rentabilité
 * sur un objet que la recommandation donnait à +90 % de ROI, et `comparerFocus`
 * pouvait même élire une autre stratégie. Les deux chiffres étaient exacts mais
 * ne répondaient pas à la même question.
 */
describe('cohérence entre la recommandation et le simulateur', () => {
  const cas: [string, Item['stats'], number, number, number][] = [
    // Cas réel : 0,13 rune Cri espérée — aucune rune entière sur un exemplaire.
    ['Baguette de Feu Follesque', [{ statId: 'intelligence', min: 5, max: 7 }, { statId: 'pctCritique', min: 2, max: 2 }], 10, 27, 165],
    ['Objet à une ligne', [{ statId: 'force', min: 100, max: 100 }], 100, 100, 10_000],
    ['Objet lourd', [{ statId: 'pa', min: 1, max: 1 }, { statId: 'vitalite', min: 200, max: 200 }], 150, 80, 50_000],
    ['Objet avec malus', [{ statId: 'agilite', min: 30, max: 40 }, { statId: 'pm', min: -1, max: -1 }], 60, 45, 800],
  ];

  it.each(cas)('%s : même stratégie et même marge des deux côtés', (nom, stats, niveau, coef, cout) => {
    const item = obj(nom, stats, niveau);
    // Prix relevés sur Draconiros : la Baguette de Feu Follesque n'est rentable
    // que parce que la Rune Cri y vaut 2 389, pas aux prix fictifs par défaut.
    const ctx = contexte('greedy', prixTest({ 'Rune Cri': 2389, 'Rune Ine': 56 }));
    const opts = { ...OPT, budget: 10_000_000, taxePct: 2, couts: couts([item, cout]), roiMin: -1000, coefficient: coef };
    const [o] = recommanderBrisage([item], ctx, opts);
    expect(o, `${nom} devrait être évalué`).toBeDefined();

    const lignes = lignesDepuisItem(item, 'moyen');
    const strategies = comparerFocus(
      { niveau, lignes, coefficient: coef, focus: null },
      ctx,
      { prixRevient: cout, taxePct: 2, nbObjets: 1 },
    );
    expect(strategies[0].focus).toBe(o.focus);
    expect(strategies[0].bilan[strategies[0].bilan.retenu].benefice).toBeCloseTo(o.benefice, 6);
    // Les deux doivent s'accorder sur le signe : pas de « +90 % » d'un côté et « −100 % » de l'autre.
    expect(Math.sign(strategies[0].bilan.espere.benefice)).toBe(Math.sign(o.benefice));
  });
});
