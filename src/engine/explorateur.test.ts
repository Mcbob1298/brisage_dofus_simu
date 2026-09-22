import { describe, expect, it } from 'vitest';
import type { Item } from '../data/types.ts';
import { evaluerItem, lignesDepuisItem } from './explorateur.ts';
import { calculerBrisage } from './brisage.ts';
import { contexte, prixTest } from './fixtures.test-utils.ts';

const objet: Item = {
  id: 1,
  nom: 'Test',
  niveau: 100,
  type: 'Anneau',
  famille: 'Équipement',
  imageLocale: '',
  stats: [
    { statId: 'force', min: 20, max: 30 },
    { statId: 'sagesse', min: 20, max: 30 },
    { statId: 'vitalite', min: 80, max: 100 },
    { statId: 'intelligence', min: -20, max: -10 },
  ],
};

describe('evaluerItem', () => {
  it('lignesDepuisItem respecte le jet choisi', () => {
    expect(lignesDepuisItem(objet, 'max').map((l) => l.jet)).toEqual([30, 30, 100, -10]);
    expect(lignesDepuisItem(objet, 'min').map((l) => l.jet)).toEqual([20, 20, 80, -20]);
    expect(lignesDepuisItem(objet, 'moyen').map((l) => l.jet)).toEqual([25, 25, 90, -15]);
  });

  it('valeur naturelle = valeur espérée du moteur à coef 100 %', () => {
    const ctx = contexte('toutSimple');
    const ev = evaluerItem(objet, ctx, 'max');
    const attendu = calculerBrisage({ niveau: 100, lignes: lignesDepuisItem(objet, 'max'), coefficient: 100, focus: null }, ctx);
    expect(ev.valeurNaturel).toBeCloseTo(attendu.valeurEsperee, 6);
    expect(ev.prixManquants).toBe(false);
  });

  it('trouve le meilleur focus quand il bat le naturel, et ne propose jamais un focus sur un malus', () => {
    const ctx = contexte('toutSimple', prixTest({ 'Rune Sa': 2000 }));
    const ev = evaluerItem(objet, ctx, 'max');
    expect(ev.meilleurFocus).toBe('sagesse');
    expect(ev.valeurMeilleure).toBeGreaterThan(ev.valeurNaturel);
  });

  it('naturel gagnant → meilleurFocus null et valeurs égales', () => {
    const ev = evaluerItem(objet, contexte('toutSimple'), 'max');
    expect(ev.meilleurFocus).toBeNull();
    expect(ev.valeurMeilleure).toBe(ev.valeurNaturel);
  });

  it('signale les prix manquants', () => {
    const ev = evaluerItem(objet, contexte('toutSimple', {}), 'max');
    expect(ev.prixManquants).toBe(true);
    expect(ev.valeurNaturel).toBe(0);
  });
});
