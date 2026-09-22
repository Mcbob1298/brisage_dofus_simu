import { describe, expect, it } from 'vitest';
import type { Item, Panoplie } from '../data/types.ts';
import {
  alternatives,
  bonusPanoplie,
  optimiser,
  poidsElement,
  poidsProspection,
  progression,
  prospectionTotale,
  scoreStats,
  slotDe,
  statsItem,
  CHANCE_PAR_PROSPECTION,
  ELEMENTS,
  PROSPECTION_BASE,
  SLOTS,
} from './build.ts';

let id = 1;
const obj = (type: string, stats: Item['stats'], niveau = 50, panoplieId?: number): Item => ({
  id: id++,
  nom: `${type} ${id}`,
  niveau,
  type,
  famille: type === 'Épée' ? 'Arme' : type === 'Dofus' ? 'Dofus' : type === 'Trophée' ? 'Trophée' : 'Équipement',
  imageLocale: '',
  stats,
  panoplieId,
});

const pp = (n: number) => [{ statId: 'prospection' as const, min: n, max: n }];

describe('slots', () => {
  it('mappe chaque type sur un emplacement, armes et dofus/trophées compris', () => {
    expect(slotDe(obj('Coiffe', pp(1)))).toBe('coiffe');
    expect(slotDe(obj('Anneau', pp(1)))).toBe('anneau');
    expect(slotDe(obj('Épée', pp(1)))).toBe('arme');
    expect(slotDe(obj('Trophée', pp(1)))).toBe('dofus');
    expect(slotDe(obj('Dofus', pp(1)))).toBe('dofus');
    expect(SLOTS.find((s) => s.id === 'anneau')!.capacite).toBe(2);
    expect(SLOTS.find((s) => s.id === 'dofus')!.capacite).toBe(6);
  });
});

describe('statsItem / scoreStats', () => {
  it('utilise le jet demandé et additionne les lignes de même stat', () => {
    const i = obj('Coiffe', [
      { statId: 'prospection', min: 10, max: 20 },
      { statId: 'prospection', min: 2, max: 4 },
    ]);
    expect(statsItem(i, 'max').prospection).toBe(24);
    expect(statsItem(i, 'min').prospection).toBe(12);
    expect(statsItem(i, 'moyen').prospection).toBe(18);
    expect(scoreStats(statsItem(i, 'max'), { prospection: 2 })).toBe(48);
  });
});

describe('optimiser', () => {
  const options = { niveauJoueur: 60, poids: { prospection: 1 }, jet: 'max' as const };

  it('prend le meilleur objet par emplacement et respecte les capacités', () => {
    const items = [
      obj('Coiffe', pp(10)),
      obj('Coiffe', pp(30)),
      obj('Anneau', pp(5)),
      obj('Anneau', pp(20)),
      obj('Anneau', pp(15)),
    ];
    const b = optimiser(items, options);
    expect(b.parSlot.coiffe.map((i) => statsItem(i, 'max').prospection)).toEqual([30]);
    expect(b.parSlot.anneau.map((i) => statsItem(i, 'max').prospection)).toEqual([20, 15]);
    expect(b.totaux.prospection).toBe(65);
    expect(b.score).toBe(65);
  });

  it('exclut les objets au-dessus du niveau du personnage', () => {
    const items = [obj('Coiffe', pp(100), 150), obj('Coiffe', pp(10), 40)];
    const b = optimiser(items, options);
    expect(b.totaux.prospection).toBe(10);
  });

  it('ignore les objets sans apport pour l’objectif', () => {
    const items = [obj('Coiffe', [{ statId: 'force', min: 50, max: 50 }])];
    expect(optimiser(items, options).parSlot.coiffe).toEqual([]);
  });

  it('impose les objets déjà possédés', () => {
    const mien = obj('Coiffe', pp(5));
    const mieux = obj('Coiffe', pp(50));
    const b = optimiser([mien, mieux], { ...options, fixes: [mien.id] });
    expect(b.parSlot.coiffe).toEqual([mien]);
  });

  it('préfère une panoplie quand son bonus dépasse la perte sur les pièces', () => {
    const pano: Panoplie = { id: 7, nom: 'Test', niveau: 50, bonus: { 2: [{ statId: 'prospection', valeur: 40 }] } };
    const items = [
      obj('Coiffe', pp(30)),
      obj('Cape', pp(30)),
      obj('Coiffe', pp(20), 50, 7),
      obj('Cape', pp(20), 50, 7),
    ];
    const sans = optimiser(items, options);
    expect(sans.totaux.prospection).toBe(60);
    const avec = optimiser(items, { ...options, panoplies: [pano] });
    expect(avec.totaux.prospection).toBe(80); // 20 + 20 + 40 de bonus
    expect(avec.panoplies[0].pieces).toBe(2);
  });

  it('garde le stuff libre si le bonus de panoplie ne compense pas', () => {
    const pano: Panoplie = { id: 8, nom: 'Faible', niveau: 50, bonus: { 2: [{ statId: 'prospection', valeur: 5 }] } };
    const items = [obj('Coiffe', pp(30)), obj('Cape', pp(30)), obj('Coiffe', pp(20), 50, 8), obj('Cape', pp(20), 50, 8)];
    expect(optimiser(items, { ...options, panoplies: [pano] }).totaux.prospection).toBe(60);
  });
});

describe('bonusPanoplie', () => {
  const p: Panoplie = {
    id: 1,
    nom: 'P',
    niveau: 10,
    bonus: { 2: [{ statId: 'prospection', valeur: 5 }], 4: [{ statId: 'prospection', valeur: 20 }] },
  };
  it('retient le palier atteint le plus élevé', () => {
    expect(bonusPanoplie(p, 1)).toEqual([]);
    expect(bonusPanoplie(p, 3)[0].valeur).toBe(5);
    expect(bonusPanoplie(p, 6)[0].valeur).toBe(20);
  });
});

describe('alternatives', () => {
  it('classe les objets d’un emplacement par score', () => {
    const items = [obj('Bottes', pp(5)), obj('Bottes', pp(50)), obj('Coiffe', pp(99))];
    const alt = alternatives(items, 'bottes', { niveauJoueur: 60, poids: { prospection: 1 }, jet: 'max' });
    expect(alt.map((i) => statsItem(i, 'max').prospection)).toEqual([50, 5]);
  });
});

describe('progression', () => {
  const options = { niveauJoueur: 30, poids: { prospection: 1 }, jet: 'max' as const };

  it('liste les objets qui deviendront meilleurs en montant de niveau', () => {
    const porte = obj('Coiffe', pp(10), 20);
    const items = [porte, obj('Coiffe', pp(5), 40), obj('Coiffe', pp(20), 50), obj('Coiffe', pp(40), 80)];
    const etapes = progression(items, options);
    expect(etapes.map((e) => ({ niveau: e.niveau, gain: e.gain }))).toEqual([
      { niveau: 50, gain: 10 },
      { niveau: 80, gain: 20 },
    ]);
    expect(etapes[0].remplace).toBe(porte);
  });

  it('ignore les objets moins bons que celui déjà portable', () => {
    const items = [obj('Bottes', pp(50), 10), obj('Bottes', pp(20), 60)];
    expect(progression(items, options)).toEqual([]);
  });

  it('classe toutes les étapes par niveau croissant', () => {
    const items = [obj('Coiffe', pp(40), 80), obj('Cape', pp(10), 35), obj('Bottes', pp(5), 60)];
    expect(progression(items, options).map((e) => e.niveau)).toEqual([35, 60, 80]);
  });
});

describe('poidsElement', () => {
  it('ne pondère que la caractéristique et les dommages de l’élément choisi', () => {
    const p = poidsElement('terre');
    expect(p.force).toBe(1);
    expect(p.doTerre).toBe(8);
    expect(p.doFeu).toBeUndefined();
    expect(p.intelligence).toBeUndefined();
    expect(poidsElement('air').agilite).toBe(1);
    expect(ELEMENTS.map((e) => e.id)).toEqual(['terre', 'feu', 'eau', 'air']);
  });

  it('peut mélanger prospection et dégâts', () => {
    expect(poidsElement('eau', 5).prospection).toBe(5);
  });
});

describe('prospection réelle (base 100 + chance/10 + équipement)', () => {
  it('cumule la base, la chance et la prospection de l’équipement', () => {
    const d = prospectionTotale({ prospection: 45, chance: 120 });
    expect(d.base).toBe(PROSPECTION_BASE);
    expect(d.parChance).toBe(12);
    expect(d.equipement).toBe(45);
    expect(d.total).toBe(157);
  });

  it('arrondit la chance vers le bas : 19 chance = 1 prospection', () => {
    expect(prospectionTotale({ chance: 19 }).parChance).toBe(1);
    expect(prospectionTotale({ chance: 20 }).parChance).toBe(2);
  });

  it('compte la chance hors équipement (points investis, parchemins)', () => {
    expect(prospectionTotale({ chance: 50 }, 150).parChance).toBe(20);
  });

  it('sans rien, la prospection vaut la base', () => {
    expect(prospectionTotale({}).total).toBe(100);
  });

  it('l’objectif prospection pondère la chance à 1 pour 10', () => {
    const p = poidsProspection();
    expect(p.prospection).toBe(1);
    expect(p.chance).toBeCloseTo(0.1, 10);
    expect(CHANCE_PAR_PROSPECTION).toBe(10);
  });

  it('à score égal, 10 chance valent autant qu’1 prospection', () => {
    const p = poidsProspection();
    expect(scoreStats({ chance: 10 }, p)).toBeCloseTo(scoreStats({ prospection: 1 }, p), 10);
  });
});
