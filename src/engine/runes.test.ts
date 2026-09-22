import { describe, expect, it } from 'vitest';
import { repartirRunes } from './runes.ts';
import { prixTest, runeParNom, runesDe } from './fixtures.test-utils.ts';

const q = (rep: ReturnType<typeof repartirRunes>) =>
  Object.fromEntries(rep.runes.map((r) => [r.rune.nom, r.quantite]));

describe('repartirRunes — greedy (Ra, puis Pa, puis simples)', () => {
  it('47 Force → 4 Ra + 2 Pa + 1 simple, reste 0', () => {
    const rep = repartirRunes(47, runesDe('force'), 'greedy', prixTest());
    expect(q(rep)).toEqual({ 'Rune Ra Fo': 4, 'Rune Pa Fo': 2, 'Rune Fo': 1 });
    expect(rep.reste).toBeCloseTo(0, 9);
    expect(rep.runeReste).toBe(runeParNom('Rune Fo'));
  });

  it('conserve le reste fractionnaire : 47,6 Force → même répartition, reste 0,6', () => {
    const rep = repartirRunes(47.6, runesDe('force'), 'greedy', prixTest());
    expect(q(rep)).toEqual({ 'Rune Ra Fo': 4, 'Rune Pa Fo': 2, 'Rune Fo': 1 });
    expect(rep.reste).toBeCloseTo(0.6, 9);
  });

  it('tient compte de la valeur de la rune simple : 900 Vitalité → 18 Ra Vi (50 chacune)', () => {
    const rep = repartirRunes(900, runesDe('vitalite'), 'greedy', prixTest());
    expect(q(rep)).toEqual({ 'Rune Ra Vi': 18 });
    expect(rep.reste).toBeCloseTo(0, 9);
  });

  it('37,5 Vitalité → 2 Pa Vi (30) + 1 Vi (5) + reste 0,5 (2,5 points sur 5)', () => {
    const rep = repartirRunes(37.5, runesDe('vitalite'), 'greedy', prixTest());
    expect(q(rep)).toEqual({ 'Rune Pa Vi': 2, 'Rune Vi': 1 });
    expect(rep.reste).toBeCloseTo(0.5, 9);
  });

  it('stat sans Pa ni Ra (Critique) → tout en simples', () => {
    const rep = repartirRunes(23, runesDe('pctCritique'), 'greedy', prixTest());
    expect(q(rep)).toEqual({ 'Rune Cri': 23 });
  });

  it('moins d’une rune → aucune rune, reste = probabilité', () => {
    const rep = repartirRunes(0.7, runesDe('pctCritique'), 'greedy', prixTest());
    expect(rep.runes).toEqual([]);
    expect(rep.reste).toBeCloseTo(0.7, 9);
    expect(rep.runeReste).toBe(runeParNom('Rune Cri'));
  });

  it('un reste de bruit flottant (900,0000000000001 Ini) vaut 0', () => {
    const rep = repartirRunes(300 * 200 * 0.015, runesDe('initiative'), 'greedy', prixTest());
    expect(q(rep)).toEqual({ 'Rune Ra Ini': 9 });
    expect(rep.reste).toBe(0);
  });

  it('résiste au bruit flottant : 10 − 1e-12 points donne bien 1 Ra', () => {
    const rep = repartirRunes(10 - 1e-12, runesDe('force'), 'greedy', prixTest());
    expect(q(rep)).toEqual({ 'Rune Ra Fo': 1 });
    expect(rep.reste).toBe(0);
  });

  it('0 point ou stat sans rune → rien', () => {
    expect(repartirRunes(0, runesDe('force'), 'greedy', prixTest()).runes).toEqual([]);
    const sansRune = repartirRunes(50, [], 'greedy', prixTest());
    expect(sansRune.runes).toEqual([]);
    expect(sansRune.runeReste).toBeNull();
    expect(sansRune.reste).toBe(0);
  });
});

describe('repartirRunes — toutSimple', () => {
  it('47,6 Force → 47 Rune Fo, reste 0,6', () => {
    const rep = repartirRunes(47.6, runesDe('force'), 'toutSimple', prixTest());
    expect(q(rep)).toEqual({ 'Rune Fo': 47 });
    expect(rep.reste).toBeCloseTo(0.6, 9);
  });
});

describe('repartirRunes — valeurMax (sac-à-dos)', () => {
  it('prix proportionnels → même résultat que greedy', () => {
    const rep = repartirRunes(47, runesDe('force'), 'valeurMax', prixTest());
    expect(q(rep)).toEqual({ 'Rune Ra Fo': 4, 'Rune Pa Fo': 2, 'Rune Fo': 1 });
  });

  it('préfère les Pa si elles rapportent plus que les Ra', () => {
    // Pa Fo à 500 (×3 = 1500 pour 9 unités) contre Ra Fo à 1000 pour 10 unités.
    const prix = prixTest({ 'Rune Pa Fo': 500, 'Rune Ra Fo': 1000, 'Rune Fo': 100 });
    const rep = repartirRunes(30, runesDe('force'), 'valeurMax', prix);
    // 10 Pa = 5000 > 3 Ra = 3000 > mélanges
    expect(q(rep)).toEqual({ 'Rune Pa Fo': 10 });
  });

  it('préfère les simples si elles rapportent plus', () => {
    const prix = prixTest({ 'Rune Fo': 200, 'Rune Pa Fo': 300, 'Rune Ra Fo': 1000 });
    const rep = repartirRunes(12, runesDe('force'), 'valeurMax', prix);
    expect(q(rep)).toEqual({ 'Rune Fo': 12 });
  });

  it('maximise réellement la valeur (vérification exhaustive)', () => {
    const prix = prixTest({ 'Rune Fo': 130, 'Rune Pa Fo': 350, 'Rune Ra Fo': 1250 });
    const unites = 23;
    const rep = repartirRunes(unites, runesDe('force'), 'valeurMax', prix);
    const valeur = rep.runes.reduce((s, r) => s + r.quantite * r.prixUnitaire!, 0);
    let meilleur = 0;
    for (let ra = 0; ra * 10 <= unites; ra++) {
      for (let pa = 0; ra * 10 + pa * 3 <= unites; pa++) {
        const s = unites - ra * 10 - pa * 3;
        meilleur = Math.max(meilleur, ra * 1250 + pa * 350 + s * 130);
      }
    }
    expect(valeur).toBe(meilleur);
    expect(rep.runes.reduce((s, r) => s + r.quantite * Math.round(r.rune.valeur), 0)).toBe(unites);
  });

  it('sans aucun prix, retombe sur les grosses dénominations', () => {
    const rep = repartirRunes(13, runesDe('force'), 'valeurMax', {});
    expect(q(rep)).toEqual({ 'Rune Ra Fo': 1, 'Rune Pa Fo': 1 });
    expect(rep.runes.every((r) => r.prixUnitaire === undefined)).toBe(true);
  });
});
