import { describe, expect, it } from 'vitest';
import type { Item, Monstre } from '../data/types.ts';
import { evaluerFarm, evaluerMonstre } from './farm.ts';
import { evaluerItem } from './explorateur.ts';
import { contexte } from './fixtures.test-utils.ts';

const objet = (id: number, nom: string): Item => ({
  id,
  nom,
  niveau: 50,
  type: 'Anneau',
  famille: 'Équipement',
  imageLocale: '',
  stats: [
    { statId: 'force', min: 20, max: 30 },
    { statId: 'vitalite', min: 40, max: 60 },
  ],
});

const a = objet(1, 'Objet A');
const b = objet(2, 'Objet B');
const parId = new Map([
  [a.id, a],
  [b.id, b],
]);

const monstre = (drops: Monstre['drops']): Monstre => ({
  id: 10,
  nom: 'Bouftou',
  niveau: 40,
  niveauMax: 45,
  boss: false,
  archimonstre: false,
  zones: ['Amakna / Plaine'],
  drops,
});

const OPT = { niveauJoueur: 60, prospection: 100, coefficient: 100, taxePct: 0, jet: 'moyen' as const, ecartNiveauMax: 10 };

describe('evaluerMonstre', () => {
  it('valeur par combat = somme des taux × valeur de chaque objet', () => {
    const ctx = contexte('toutSimple');
    const m = evaluerMonstre(monstre([{ itemId: 1, taux: 10 }, { itemId: 2, taux: 5 }]), parId, ctx, OPT);
    const vA = evaluerItem(a, ctx, 'moyen', 100).valeurMeilleure;
    const vB = evaluerItem(b, ctx, 'moyen', 100).valeurMeilleure;
    expect(m.valeurParCombat).toBeCloseTo(0.1 * vA + 0.05 * vB, 6);
    expect(m.combatsParObjet).toBeCloseTo(100 / 15, 6);
  });

  it('applique la taxe de vente', () => {
    const ctx = contexte('toutSimple');
    const sans = evaluerMonstre(monstre([{ itemId: 1, taux: 10 }]), parId, ctx, OPT);
    const avec = evaluerMonstre(monstre([{ itemId: 1, taux: 10 }]), parId, ctx, { ...OPT, taxePct: 2 });
    expect(avec.valeurParCombat).toBeCloseTo(sans.valeurParCombat * 0.98, 6);
  });

  it('la prospection module le taux linéairement et le plafonne à 100 %', () => {
    const ctx = contexte('toutSimple');
    const base = evaluerMonstre(monstre([{ itemId: 1, taux: 10 }]), parId, ctx, OPT);
    const pp200 = evaluerMonstre(monstre([{ itemId: 1, taux: 10 }]), parId, ctx, { ...OPT, prospection: 200 });
    expect(pp200.valeurParCombat).toBeCloseTo(base.valeurParCombat * 2, 6);
    const plafond = evaluerMonstre(monstre([{ itemId: 1, taux: 60 }]), parId, ctx, { ...OPT, prospection: 500 });
    expect(plafond.drops[0].taux).toBe(100);
  });

  it('ignore les drops interdits au niveau du joueur', () => {
    const ctx = contexte('toutSimple');
    const m = monstre([
      { itemId: 1, taux: 10, plMin: 100 },
      { itemId: 2, taux: 5, plMax: 30 },
    ]);
    expect(evaluerMonstre(m, parId, ctx, OPT).drops).toEqual([]);
    expect(evaluerMonstre(m, parId, ctx, { ...OPT, niveauJoueur: 120 }).drops).toHaveLength(1);
  });

  it('le coefficient joue linéairement', () => {
    const ctx = contexte('toutSimple');
    const c100 = evaluerMonstre(monstre([{ itemId: 1, taux: 10 }]), parId, ctx, OPT);
    const c50 = evaluerMonstre(monstre([{ itemId: 1, taux: 10 }]), parId, ctx, { ...OPT, coefficient: 50 });
    expect(c50.valeurParCombat).toBeCloseTo(c100.valeurParCombat / 2, 6);
  });
});

describe('evaluerFarm', () => {
  it('écarte les monstres trop hauts en niveau et classe par valeur', () => {
    const ctx = contexte('toutSimple');
    const bas = { ...monstre([{ itemId: 1, taux: 5 }]), id: 1, niveau: 40 };
    const riche = { ...monstre([{ itemId: 1, taux: 50 }]), id: 2, niveau: 65 };
    const tropHaut = { ...monstre([{ itemId: 1, taux: 99 }]), id: 3, niveau: 150 };
    const r = evaluerFarm([bas, riche, tropHaut], parId, ctx, OPT);
    expect(r.map((x) => x.monstre.id)).toEqual([2, 1]);
  });

  it('ignore un monstre dont aucun drop n’est exploitable', () => {
    const ctx = contexte('toutSimple');
    const inconnu = monstre([{ itemId: 999, taux: 50 }]);
    expect(evaluerFarm([inconnu], parId, ctx, OPT)).toEqual([]);
  });
});

describe('filtres de cibles', () => {
  const ctx = contexte('toutSimple');
  const normal = { ...monstre([{ itemId: 1, taux: 5 }]), id: 1 };
  const archi = { ...monstre([{ itemId: 1, taux: 90 }]), id: 2, archimonstre: true };
  const patron = { ...monstre([{ itemId: 1, taux: 50 }]), id: 3, boss: true };

  it('exclut les archimonstres par défaut', () => {
    expect(evaluerFarm([normal, archi], parId, ctx, OPT).map((m) => m.monstre.id)).toEqual([1]);
    expect(evaluerFarm([normal, archi], parId, ctx, { ...OPT, inclureArchimonstres: true }).map((m) => m.monstre.id)).toEqual([2, 1]);
  });

  it('garde les boss de donjon sauf si on les exclut', () => {
    expect(evaluerFarm([normal, patron], parId, ctx, OPT).map((m) => m.monstre.id)).toEqual([3, 1]);
    expect(evaluerFarm([normal, patron], parId, ctx, { ...OPT, inclureBoss: false }).map((m) => m.monstre.id)).toEqual([1]);
  });
});
