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
  it('cas de contrôle : niveau 65, 10 % Critique, coef 100 % → 9,85', () => {
    // poids_ligne = 10 × 10 (poids Cri) × 65 × 0,015 + 1 = 97,5 + 1 = 98,5
    // points = 98,5 ÷ 10 = 9,85
    // La spec §3 annonce 9,75 : elle omet le plancher, cf. PLANCHER_LIGNE.
    const pts = calculerPoints(
      entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] }),
      POIDS_DEFAUT,
    );
    expect(pts.pctCritique).toBeCloseTo(9.85, 10);
  });

  it('seule la part de jet suit le niveau, le plancher est constant : niveau 130 → 19,6', () => {
    // 10 × 10 × 130 × 0,015 + 1 = 195 + 1 = 196 → ÷ 10 = 19,6
    // (et non le double de 9,85 : le plancher ne double pas avec le niveau)
    const pts = calculerPoints(
      entree({ niveau: 130, lignes: [{ statId: 'pctCritique', jet: 10 }] }),
      POIDS_DEFAUT,
    );
    expect(pts.pctCritique).toBeCloseTo(19.6, 10);
  });

  it('est linéaire en coefficient : 200 % → le double, 50 % → la moitié', () => {
    const base = entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] });
    const p100 = calculerPoints(base, POIDS_DEFAUT).pctCritique!;
    const p200 = calculerPoints({ ...base, coefficient: 200 }, POIDS_DEFAUT).pctCritique!;
    const p50 = calculerPoints({ ...base, coefficient: 50 }, POIDS_DEFAUT).pctCritique!;
    expect(p200).toBeCloseTo(2 * p100, 10);
    expect(p50).toBeCloseTo(p100 / 2, 10);
  });

  it('la part de jet ignore le poids, le plancher vaut 1 ÷ poids unitaire', () => {
    // 300 vitalité niveau 200, poids unitaire 0,25 :
    //   part de jet = 300 × 200 × 0,015 = 900 points (le poids se simplifie)
    //   plancher    = 1 ÷ 0,25 = 4 points, soit une rune Vi (valeur 5) pour 0,8
    const pts = calculerPoints(entree({ niveau: 200, lignes: [{ statId: 'vitalite', jet: 300 }] }), POIDS_DEFAUT);
    expect(pts.vitalite).toBeCloseTo(904, 10);

    // Une stat lourde a un plancher plus léger : 1 ÷ 100 pour les PA.
    const pa = calculerPoints(entree({ niveau: 200, lignes: [{ statId: 'pa', jet: 1 }] }), POIDS_DEFAUT);
    expect(pa.pa).toBeCloseTo(1 * 200 * 0.015 + 1 / 100, 10);
  });

  it('ignore les lignes de malus (jet < 0), mais garde les jets nuls', () => {
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
    expect(pts.force).toBeCloseTo(76, 10); // 50 × 100 × 0,015 + 1

    // Un jet nul n'est pas un malus : la ligne pèse son plancher.
    // Cas réel : Arc de Chasse, drapeau « Arme de chasse » sans valeur.
    const nul = calculerPoints(entree({ niveau: 100, lignes: [{ statId: 'armeDeChasse', jet: 0 }] }), POIDS_DEFAUT);
    expect(nul.armeDeChasse).toBeCloseTo(1 / 5, 10);
  });

  it('additionne deux lignes de la même stat sans compter deux planchers', () => {
    const pts = calculerPoints(
      entree({ niveau: 100, lignes: [{ statId: 'force', jet: 10 }, { statId: 'force', jet: 20 }] }),
      POIDS_DEFAUT,
    );
    // (10 + 20) × 100 × 0,015 + 1 = 46, et non 45 + 2 planchers
    expect(pts.force).toBeCloseTo(46, 10);
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
    // poids des lignes (plancher compris), niveau 100 → échelle 1,5 :
    //   force    = 100×1×1,5    + 1 = 151
    //   sagesse  =  20×3×1,5    + 1 =  91
    //   vitalité = 200×0,25×1,5 + 1 =  76
    // poids_effectif = 151 + (91 + 76) / 2 = 234,5 ; points = 234,5 ÷ 1
    expect(pts.force).toBeCloseTo(234.5, 10);
  });

  it('divise par le poids de la stat focus', () => {
    const pts = calculerPoints({ ...objet, focus: 'sagesse' }, POIDS_DEFAUT);
    // poids_effectif = 91 + (151 + 76) / 2 = 204,5 ; points = 204,5 ÷ 3
    expect(pts.sagesse).toBeCloseTo(204.5 / 3, 10);
  });

  it('focus sur une stat seule = brisage naturel de cette ligne', () => {
    const seul = entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] });
    expect(calculerPoints({ ...seul, focus: 'pctCritique' }, POIDS_DEFAUT).pctCritique).toBeCloseTo(9.85, 10);
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
  it('9,85 Cri → 9 runes garanties + 85 % de chance d’une de plus', () => {
    const res = calculerBrisage(entree({ niveau: 65, lignes: [{ statId: 'pctCritique', jet: 10 }] }), contexte());
    const cri = res.parStat[0];
    expect(cri.runes).toEqual([{ rune: runeParNom('Rune Cri'), quantite: 9, prixUnitaire: 1000 }]);
    expect(cri.reste).toBeCloseTo(0.85, 9);
    expect(res.valeurGarantie).toBe(9000);
    expect(res.valeurEsperee).toBeCloseTo(9850, 6);
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
    expect(b.espere.valeurBrute).toBeCloseTo(98500, 6); // 9,85 × 1000 × 10
    expect(b.coutTotal).toBe(50000);
    expect(b.espere.benefice).toBeCloseTo(48500, 6);
  });

  it('ROI null si le coût est nul', () => {
    expect(calculerBilan(res, OPTIONS_1).garanti.roi).toBeNull();
  });
});

describe('coefficientSeuil', () => {
  const objet = { niveau: 65, lignes: [{ statId: 'pctCritique' as const, jet: 10 }], focus: null };

  it('le bénéfice espéré est nul au seuil, positif juste au-dessus, négatif juste en dessous', () => {
    // toutSimple : valeur espérée strictement linéaire en coef → seuil analytique.
    // valeur(coef) = 9,85 × coef/100 × 1000 kamas ; taxe 2 % ; prix de revient 5000
    // 9850 × c × 0,98 = 5000 → c = 0,51797… → 51,80 %
    const ctx = contexte('toutSimple');
    const options = { prixRevient: 5000, taxePct: 2, nbObjets: 1 };
    const seuil = coefficientSeuil(objet, ctx, options, 1e-6)!;
    expect(seuil).toBeCloseTo((5000 / (9850 * 0.98)) * 100, 3);

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

describe('ancrage sur une référence externe', () => {
  it('reproduit le relevé DoFocus de l’Arc de Chasse', () => {
    // DoFocus, serveur Draconiros, relevé le 2026-09-26 : Arc de Chasse
    // (niveau 1), ligne « Arme de chasse » sans valeur dans les deux API
    // (jet 0, poids unitaire 5), coefficient mesuré 15 %.
    // Affiché : 0,03 rune, soit 266 kamas à 8 870 la Rune de chasse.
    // Tout vient du plancher : 1 × 0,15 ÷ 5 = 0,03.
    const pts = calculerPoints(
      entree({ niveau: 1, coefficient: 15, lignes: [{ statId: 'armeDeChasse', jet: 0 }] }),
      POIDS_DEFAUT,
    );
    expect(pts.armeDeChasse).toBeCloseTo(0.03, 10);
    expect(Math.round(pts.armeDeChasse! * 8870)).toBe(266);
  });
});

describe('ligne sans valeur chiffrée — non focalisable', () => {
  // Baguette de Liriel (niveau 20) : % Critique 3, Arme de chasse 0, Agilité 15.
  // Le drapeau « Arme de chasse » n'a pas de valeur dans les deux API. Il pèse
  // son plancher en brisage naturel, mais le concasseur ne l'offre PAS au focus
  // — constaté en jeu le 2026-09-26 : seuls % Critique et Agilité sont proposés.
  // Sans ce garde-fou, un focus fictif sur cette ligne convertissait tout le
  // poids de l'objet en Rune Chas (8 797 kamas pièce) et faisait passer un objet
  // à perte pour une affaire à +4 733 kamas.
  const liriel = entree({
    niveau: 20,
    coefficient: 72,
    lignes: [
      { statId: 'pctCritique', jet: 3 },
      { statId: 'armeDeChasse', jet: 0 },
      { statId: 'agilite', jet: 15 },
    ],
  });

  it('rend quand même son plancher en brisage naturel', () => {
    const pts = calculerPoints(liriel, POIDS_DEFAUT);
    expect(pts.armeDeChasse).toBeCloseTo((1 * 0.72) / 5, 10); // 0,144 point
  });

  it('ne peut pas servir de cible de focus', () => {
    expect(calculerPoints({ ...liriel, focus: 'armeDeChasse' }, POIDS_DEFAUT)).toEqual({});
  });

  it('n’est pas proposée parmi les stratégies comparées', () => {
    const strategies = comparerFocus(liriel, contexte('toutSimple'), OPTIONS_1);
    expect(strategies.map((s) => s.focus)).toEqual(
      expect.arrayContaining([null, 'pctCritique', 'agilite']),
    );
    expect(strategies.map((s) => s.focus)).not.toContain('armeDeChasse');
  });

  it('la meilleure stratégie reste le brisage naturel, pas un focus fictif', () => {
    // Sur un lot, le bilan compare les espérances (sur un seul objet il
    // comparerait les runes garanties, ce qui avantage la ligne la plus fournie).
    const strategies = comparerFocus(liriel, contexte('toutSimple'), { prixRevient: 0, taxePct: 0, nbObjets: 10 });
    expect(strategies[0].focus).toBeNull();
    // 0,72 Cri × 1000 + 0,144 Chas × 8797 + 3,96 Age × 85 ≈ 2 323 kamas.
    expect(strategies[0].resultat.valeurEsperee).toBeCloseTo(2323.368, 3);
    // Le focus fictif sur « Arme de chasse » valait 1,26 Chas, soit 11 084 kamas.
    for (const s of strategies) expect(s.resultat.valeurEsperee).toBeLessThan(11_000);
  });
});
