import { describe, expect, it } from 'vitest';
import { hdvUtilisable, indexerHdv, offreHdv } from './hdv.ts';
import type { PrixHdv } from '../data/types.ts';

describe('offreHdv', () => {
  it('divise le prix du lot par sa taille', () => {
    // Le piège du format : 3 900 est le prix des 10, pas de l'unité.
    const o = offreHdv({ lots: [{ taille: 10, prixDuLot: 3900, quantiteEnVente: 7 }] })!;
    expect(o.prixUnitaire).toBe(390);
    expect(o.taille).toBe(10);
  });

  it('retient le meilleur prix unitaire, pas le plus petit prix affiché', () => {
    // Le lot de 1 est le moins cher à l'écran mais le plus cher à l'unité.
    const o = offreHdv({
      lots: [
        { taille: 1, prixDuLot: 420, quantiteEnVente: 58 },
        { taille: 10, prixDuLot: 3900, quantiteEnVente: 7 },
        { taille: 100, prixDuLot: 36000, quantiteEnVente: 2 },
      ],
    })!;
    expect(o.prixUnitaire).toBe(360);
    expect(o.taille).toBe(100);
  });

  it('compte les exemplaires en vente à ce prix, et le total toutes offres', () => {
    const o = offreHdv({
      lots: [
        { taille: 1, prixDuLot: 420, quantiteEnVente: 58 },
        { taille: 10, prixDuLot: 3900, quantiteEnVente: 7 },
      ],
    })!;
    expect(o.prixUnitaire).toBe(390);
    expect(o.disponible).toBe(70); // 7 lots de 10 au meilleur prix
    expect(o.disponibleTotal).toBe(128); // + les 58 à l'unité, plus chers
  });

  it('accepte la forme courte : un nombre vaut prix unitaire', () => {
    const o = offreHdv(155)!;
    expect(o.prixUnitaire).toBe(155);
    expect(o.disponible).toBeNull();
  });

  it('ne suppose rien quand les quantités manquent', () => {
    const o = offreHdv({ lots: [{ taille: 1, prixDuLot: 7122 }] })!;
    expect(o.disponible).toBeNull();
    expect(o.disponibleTotal).toBeNull();
  });

  it('écarte ce qui n’est pas exploitable plutôt que d’inventer', () => {
    expect(offreHdv(undefined)).toBeNull();
    expect(offreHdv(0)).toBeNull();
    expect(offreHdv(-5)).toBeNull();
    expect(offreHdv({ lots: [] })).toBeNull();
    expect(offreHdv({ lots: [{ taille: 0, prixDuLot: 100 }] })).toBeNull();
    expect(offreHdv({ lots: [{ taille: 1, prixDuLot: 0 }] })).toBeNull();
  });
});

describe('hdvUtilisable', () => {
  const fichier = { format: 'brisage-prix-hdv', version: 1, serveur: 'Draconiros', releveLe: '', prix: {} } as PrixHdv;

  it('refuse un relevé d’un autre serveur', () => {
    // Des prix d'ailleurs seraient pires qu'aucun prix.
    expect(hdvUtilisable(fichier, 'Draconiros')).toBe(true);
    expect(hdvUtilisable(fichier, 'Imagiro')).toBe(false);
  });

  it('refuse un fichier absent ou d’un autre format', () => {
    expect(hdvUtilisable(null, 'Draconiros')).toBe(false);
    expect(hdvUtilisable({ ...fichier, format: 'autre' } as unknown as PrixHdv, 'Draconiros')).toBe(false);
  });
});

describe('indexerHdv', () => {
  it('indexe par id numérique et saute les entrées inutilisables', () => {
    const index = indexerHdv({
      format: 'brisage-prix-hdv',
      version: 1,
      serveur: 'Draconiros',
      releveLe: '2026-09-27T06:38:23.550Z',
      prix: {
        '8116': { nom: 'Scaracoiffe Dorée', lots: [{ taille: 1, prixDuLot: 7995, quantiteEnVente: 26 }] },
        '2294': 155,
        abc: 42,
        '999': { lots: [] },
      },
    } as PrixHdv);
    expect([...index.keys()].sort((a, b) => a - b)).toEqual([2294, 8116]);
    expect(index.get(8116)!.prixUnitaire).toBe(7995);
    expect(index.get(8116)!.disponible).toBe(26);
  });
});
