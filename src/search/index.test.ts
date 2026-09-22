import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Item } from '../data/types.ts';
import { IndexRecherche } from './index.ts';

const items = JSON.parse(readFileSync(new URL('../../public/data/items.json', import.meta.url), 'utf8')) as Item[];
const index = new IndexRecherche(items);
const noms = (q: string, f?: Parameters<IndexRecherche['rechercher']>[1]) => index.rechercher(q, f, 5).map((i) => i.nom);

describe('IndexRecherche sur le catalogue réel', () => {
  it('trouve par préfixe, sans accents ni casse', () => {
    expect(noms('gelano')[0]).toBe('Gelano');
    expect(noms('EPEE DE BOIS')[0]).toBe('Épée de Boisaille');
  });

  it('tolère une faute de frappe', () => {
    expect(noms('gelnao')).toContain('Gelano');
    expect(noms('boisaile')).toContain('Épée de Boisaille');
  });

  it('cherche au milieu du nom', () => {
    expect(noms('boisaille')).toContain('Épée de Boisaille');
  });

  it('applique les filtres de type et de niveau', () => {
    const r = index.rechercher('', { type: 'Coiffe', niveauMin: 190, niveauMax: 200 });
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((i) => i.type === 'Coiffe' && i.niveau >= 190 && i.niveau <= 200)).toBe(true);
    const armes = index.rechercher('', { type: 'Arme', niveauMin: null, niveauMax: null });
    expect(armes.every((i) => i.famille === 'Arme')).toBe(true);
  });

  it('reste rapide : 200 recherches < 1 s', () => {
    const t = performance.now();
    for (let i = 0; i < 200; i++) index.rechercher('anneau du ' + 'abcdefghij'[i % 10]);
    expect(performance.now() - t).toBeLessThan(1000);
  });
});
