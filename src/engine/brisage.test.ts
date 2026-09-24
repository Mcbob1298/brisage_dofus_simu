import { describe, expect, it } from 'vitest';
import {
  calculerBilan,
  calculerBrisage,
  calculerPoints,
  coefficientSeuil,
  comparerFocus,
  prixAchatMax,
  POIDS_DEFAUT,
  SEUIL_MAX,
  SEUIL_MIN,
  type EntreeBrisage,
  type OptionsBilan,
} from './index.ts';
import { contexte, prixTest, runeParNom } from './fixtures.test-utils.ts';

const OPTIONS_1: OptionsBilan = { prixRevient: 0, taxePct: 0, nbObjets: 1 };

function entree(partial: Partial<EntreeBrisage> & Pick<EntreeBrisage, 'niveau' | 'lignes'>): EntreeBrisage {
  return { coefficient: 100, focus: null, ...partial };
}

describe('calculerPoints — formule de base', () => {
  it('cas de contrôle : niveau 65, 10 % Critique, coef 100 % → 9,75', () => {
    const pts = calculerPoints(
      entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] }),
      POIDS_DEFAUT,
    );
    expect(pts.pctCritique).toBeCloseTo(9.75, 10);
  });

  it('est linéaire en niveau : niveau 130 → 19,5', () => {
    const pts = calculerPoints(
      entree({ niveau: 130, lignes: [{ statId: 'pctCritique', jet: 10 }] }),
      POIDS_DEFAUT,
    );
    expect(pts.pctCritique).toBeCloseTo(19.5, 10);
  });

  it('est linéaire en coefficient : 200 % → le double, 50 % → la moitié', () => {
    const base = entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] });
    const p100 = calculerPoints(base, POIDS_DEFAUT).pctCritique!;
    const p200 = calculerPoints({ ...base, coefficient: 200 }, POIDS_DEFAUT).pctCritique!;
    const p50 = calculerPoints({ ...base, coefficient: 50 }, POIDS_DEFAUT).pctCritique!;
    expect(p200).toBeCloseTo(2 * p100, 10);
    expect(p50).toBeCloseTo(p100 / 2, 10);
  });

  it('ne dépend pas du poids en brisage naturel (poids_rune = poids_unitaire)', () => {
    // 300 vitalité niveau 200 → 300 × 200 × 0,015 = 900 points de vitalité
    const pts = calculerPoints(entree({ niveau: 200, lignes: [{ statId: 'vitalite', jet: 300 }] }), POIDS_DEFAUT);
    expect(pts.vitalite).toBeCloseTo(900, 10);
  });

  it('ignore les lignes de malus (jet ≤ 0)', () => {
    const pts = calculerPoints(
      entree({
        niveau: 100,
        lignes: [
          { statId: 'force', jet: 50 },
          { statId: 'sagesse', jet: -20 },
        ],
      }),
      POIDS_DEFAUT,
    );
    expect(pts.sagesse).toBeUndefined();
    expect(pts.force).toBeCloseTo(75, 10);
  });

  it('additionne deux lignes de la même stat', () => {
    const pts = calculerPoints(
      entree({ niveau: 100, lignes: [{ statId: 'force', jet: 10 }, { statId: 'force', jet: 20 }] }),
      POIDS_DEFAUT,
    );
    expect(pts.force).toBeCloseTo(45, 10);
  });
});

describe('calculerPoints — focus', () => {
  // Objet niveau 100 : 100 Force (poids 1) + 20 Sagesse (poids 3) + 200 Vitalité (poids 0,25)
  const objet = entree({
    niveau: 100,
    lignes: [
      { statId: 'force', jet: 100 },
      { statId: 'sagesse', jet: 20 },
      { statId: 'vitalite', jet: 200 },
    ],
  });

  it('les autres lignes ne produisent rien', () => {
    const pts = calculerPoints({ ...objet, focus: 'force' }, POIDS_DEFAUT);
    expect(Object.keys(pts)).toEqual(['force']);
  });

  it('transfère la moitié du poids des autres lignes sur la ligne focus', () => {
    const pts = calculerPoints({ ...objet, focus: 'force' }, POIDS_DEFAUT);
    // poids_effectif = 100×1 + (20×3 + 200×0,25) / 2 = 100 + 55 = 155
    // points = 155 × 100 × 0,015 × 1 ÷ 1 = 232,5
    expect(pts.force).toBeCloseTo(232.5, 10);
  });

  it('divise par le poids de la stat focus', () => {
    const pts = calculerPoints({ ...objet, focus: 'sagesse' }, POIDS_DEFAUT);
    // poids_effectif = 20×3 + (100×1 + 200×0,25) / 2 = 60 + 75 = 135
    // points = 135 × 100 × 0,015 ÷ 3 = 67,5
    expect(pts.sagesse).toBeCloseTo(67.5, 10);
  });

  it('focus sur une stat seule = brisage naturel de cette ligne', () => {
    const seul = entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] });
    expect(calculerPoints({ ...seul, focus: 'pctCritique' }, POIDS_DEFAUT).pctCritique).toBeCloseTo(9.75, 10);
  });

  it('focus sur une stat absente de l’objet ne rend rien', () => {
    const pts = calculerPoints({ ...objet, focus: 'intelligence' }, POIDS_DEFAUT);
    expect(pts).toEqual({});
  });

  it('les lignes de malus ne transfèrent rien au focus', () => {
    const avecMalus = { ...objet, lignes: [...objet.lignes, { statId: 'intelligence' as const, jet: -50 }] };
    const sans = calculerPoints({ ...objet, focus: 'force' }, POIDS_DEFAUT).force;
    const avec = calculerPoints({ ...avecMalus, focus: 'force' }, POIDS_DEFAUT).force;
    expect(avec).toBeCloseTo(sans!, 10);
  });
});

describe('calculerBrisage — valeurs et restes', () => {
  it('9,75 Cri → 9 runes garanties + 75 % de chance d’une de plus', () => {
    const res = calculerBrisage(entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] }), contexte());
    const cri = res.parStat[0];
    expect(cri.runes).toEqual([{ rune: runeParNom('Rune Cri'), quantite: 9, prixUnitaire: 1000 }]);
    expect(cri.reste).toBeCloseTo(0.75, 9);
    expect(res.valeurGarantie).toBe(9000);
    expect(res.valeurEsperee).toBeCloseTo(9750, 6);
  });

  it('signale les runes sans prix et les compte à 0', () => {
    const ctx = contexte('greedy', {});
    const res = calculerBrisage(entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] }), ctx);
    expect(res.valeurGarantie).toBe(0);
    expect(res.prixManquants.map((r) => r.nom)).toEqual(['Rune Cri']);
  });
});

describe('calculerBilan', () => {
  const res = calculerBrisage(entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] }), contexte());

  it('applique la taxe et le prix de revient', () => {
    const b = calculerBilan(res, { prixRevient: 5000, taxePct: 2, nbObjets: 1 });
    expect(b.retenu).toBe('garanti');
    expect(b.garanti.valeurBrute).toBe(9000);
    expect(b.garanti.taxe).toBeCloseTo(180, 9);
    expect(b.garanti.valeurNette).toBeCloseTo(8820, 9);
    expect(b.garanti.benefice).toBeCloseTo(3820, 9);
    expect(b.garanti.roi).toBeCloseTo(76.4, 9);
  });

  it('utilise l’espérance sur un lot de N objets', () => {
    const b = calculerBilan(res, { prixRevient: 5000, taxePct: 0, nbObjets: 10 });
    expect(b.retenu).toBe('espere');
    expect(b.espere.valeurBrute).toBeCloseTo(97500, 6);
    expect(b.coutTotal).toBe(50000);
    expect(b.espere.benefice).toBeCloseTo(47500, 6);
  });

  it('ROI null si le coût est nul', () => {
    expect(calculerBilan(res, OPTIONS_1).garanti.roi).toBeNull();
  });
});

describe('coefficientSeuil', () => {
  const objet = { niveau: 65, lignes: [{ statId: 'pctCritique' as const, jet: 10 }], focus: null };

  it('le bénéfice espéré est nul au seuil, positif juste au-dessus, négatif juste en dessous', () => {
    // toutSimple : valeur espérée strictement linéaire en coef → seuil analytique.
    // valeur(coef) = 9,75 × coef/100 × 1000 kamas ; taxe 2 % ; prix de revient 5000
    // 9750 × c × 0,98 = 5000 → c = 0,52328… → 52,33 %
    const ctx = contexte('toutSimple');
    const options = { prixRevient: 5000, taxePct: 2, nbObjets: 1 };
    const seuil = coefficientSeuil(objet, ctx, options, 1e-6)!;
    expect(seuil).toBeCloseTo((5000 / (9750 * 0.98)) * 100, 3);

    const benef = (c: number) => calculerBilan(calculerBrisage({ ...objet, coefficient: c }, ctx), options).espere.benefice;
    expect(Math.abs(benef(seuil))).toBeLessThan(0.05);
    expect(benef(seuil + 0.01)).toBeGreaterThan(0);
    expect(benef(seuil - 0.01)).toBeLessThan(0);
  });

  it('fonctionne aussi en greedy (fonction en escalier) : négatif en dessous, positif au-dessus', () => {
    const ctx = contexte('greedy');
    const options = { prixRevient: 20000, taxePct: 2, nbObjets: 1 };
    const gros = { niveau: 200, lignes: [{ statId: 'force' as const, jet: 80 }], focus: null };
    const seuil = coefficientSeuil(gros, ctx, options)!;
    const benef = (c: number) => calculerBilan(calculerBrisage({ ...gros, coefficient: c }, ctx), options).espere.benefice;
    expect(benef(seuil + 0.05)).toBeGreaterThanOrEqual(0);
    expect(benef(seuil - 0.05)).toBeLessThan(0);
  });

  it('retourne null si jamais rentable à 4000 %', () => {
    const seuil = coefficientSeuil(objet, contexte(), { prixRevient: 1e12, taxePct: 0, nbObjets: 1 });
    expect(seuil).toBeNull();
  });

  it('retourne SEUIL_MIN si rentable dès 1 %', () => {
    expect(coefficientSeuil(objet, contexte(), OPTIONS_1)).toBe(SEUIL_MIN);
    expect(SEUIL_MAX).toBe(4000);
  });
});

describe('comparerFocus', () => {
  it('classe naturel + un focus par ligne, gagnant en premier', () => {
    // Sagesse très chère : le focus Sagesse doit battre le naturel.
    // naturel = 45 Fo×100 + 45 Sa×2000 + 30 Vi×50 = 96 000 ; focus Sa = 58 Sa×2000 = 116 000
    const objet = entree({
      niveau: 100,
      lignes: [
        { statId: 'force', jet: 30 },
        { statId: 'sagesse', jet: 30 },
        { statId: 'vitalite', jet: 100 },
      ],
    });
    const comp = comparerFocus(objet, contexte('toutSimple', prixTest({ 'Rune Sa': 2000 })), OPTIONS_1);
    expect(comp.map((c) => c.focus).sort()).toEqual([null, 'force', 'sagesse', 'vitalite'].sort());
    expect(comp[0].focus).toBe('sagesse');
    for (let i = 1; i < comp.length; i++) {
      expect(comp[i - 1].bilan.garanti.benefice).toBeGreaterThanOrEqual(comp[i].bilan.garanti.benefice);
    }
  });
});

describe('prixAchatMax', () => {
  it('sans marge visée, c’est la valeur nette : le bénéfice est alors nul', () => {
    const res = calculerBrisage(entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] }), contexte('toutSimple'));
    const options = { prixRevient: 0, taxePct: 2, nbObjets: 1 };
    const nette = calculerBilan(res, options).espere.valeurNette;
    const max = prixAchatMax(nette);
    expect(max).toBeCloseTo(nette, 9);
    const auMax = calculerBilan(res, { ...options, prixRevient: max });
    expect(auMax.espere.benefice).toBeCloseTo(0, 6);
  });

  it('une marge visée abaisse le prix maximum', () => {
    expect(prixAchatMax(100_000, 30)).toBeCloseTo(76_923.08, 2);
    expect(prixAchatMax(100_000, 100)).toBe(50_000);
  });

  it('acheter au prix maximum donne exactement le ROI visé', () => {
    const nette = 100_000;
    const max = prixAchatMax(nette, 30);
    expect(((nette - max) / max) * 100).toBeCloseTo(30, 9);
  });
});
