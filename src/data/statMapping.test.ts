/**
 * Vérifie le mapping API → référentiel sur les données réellement synchronisées
 * (public/data/*.json). Ces tests échouent si `npm run sync-data` n'a jamais tourné.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALL_STAT_IDS,
  API_EFFECT_TO_STAT,
  IGNORED_EFFECTS,
  STAT_BY_ID,
  isStatId,
} from './statMapping.ts';
import { POIDS_DEFAUT } from '../engine/poids.ts';
import type { EffectTypeReport, Item, RuneDef } from './types.ts';

function lire<T>(fichier: string): T {
  return JSON.parse(readFileSync(new URL(`../../public/data/${fichier}`, import.meta.url), 'utf8')) as T;
}

const items = lire<Item[]>('items.json');
const runes = lire<RuneDef[]>('runes.json');
const effets = lire<EffectTypeReport[]>('effect-types.json');

/**
 * Caractéristiques connues de l'API mais volontairement laissées non mappées,
 * faute de poids vérifié (voir rapport de sync). À vider dès qu'une source
 * fiable donne leur poids.
 */
const NON_MAPPEES_EN_ATTENTE = new Set([
  108, // % Résistance distance (Rune Ré Per Di existe en jeu)
  65, // % Résistance mêlée (Rune Ré Per Mé existe en jeu)
]);

describe('cohérence interne du référentiel', () => {
  it('chaque StatId a un libellé et un poids par défaut', () => {
    for (const id of ALL_STAT_IDS) {
      expect(STAT_BY_ID[id].label).toBeTruthy();
      expect(POIDS_DEFAUT[id]).toBeGreaterThan(0);
    }
    expect(Object.keys(POIDS_DEFAUT).sort()).toEqual([...ALL_STAT_IDS].sort());
  });

  it('le mapping API ne pointe que vers des StatId existants', () => {
    for (const statId of Object.values(API_EFFECT_TO_STAT)) expect(isStatId(statId)).toBe(true);
  });

  it('un id d’effet API n’est pas à la fois mappé et ignoré', () => {
    const doublons = Object.keys(API_EFFECT_TO_STAT).filter((k) => k in IGNORED_EFFECTS);
    expect(doublons).toEqual([]);
  });

  it('chaque StatId est atteint par au moins un id d’effet API', () => {
    const atteints = new Set(Object.values(API_EFFECT_TO_STAT));
    expect(ALL_STAT_IDS.filter((id) => !atteints.has(id))).toEqual([]);
  });
});

describe('catalogue synchronisé', () => {
  it('contient plusieurs milliers d’objets', () => {
    expect(items.length).toBeGreaterThan(2000);
    expect(items.length).toBeLessThan(10000);
  });

  it('aucune caractéristique inconnue dans le catalogue final', () => {
    const inconnues = new Set<string>();
    for (const it of items) for (const s of it.stats) if (!isStatId(s.statId)) inconnues.add(String(s.statId));
    expect([...inconnues]).toEqual([]);
  });

  it('les jets sont ordonnés (min ≤ max) et finis', () => {
    for (const it of items) {
      for (const s of it.stats) {
        expect(Number.isFinite(s.min) && Number.isFinite(s.max)).toBe(true);
        expect(s.min).toBeLessThanOrEqual(s.max);
      }
    }
  });

  it('tous les effets rencontrés sont mappés, ignorés, ou explicitement en attente', () => {
    const inattendus = effets.filter((e) => e.status === 'unmapped' && !NON_MAPPEES_EN_ATTENTE.has(e.apiId));
    expect(inattendus.map((e) => `#${e.apiId} ${e.apiName}`)).toEqual([]);
  });

  it('chaque objet a une image locale (WebP ou placeholder)', () => {
    for (const it of items) expect(it.imageLocale).toMatch(/^\/img\/(items\/\d+\.webp|placeholder\/[a-z]+\.svg)$/);
  });
});

describe('runes synchronisées', () => {
  it('chaque rune pointe vers un StatId connu avec une valeur positive', () => {
    for (const r of runes) {
      expect(isStatId(r.statId)).toBe(true);
      expect(r.valeur).toBeGreaterThan(0);
      expect(['simple', 'pa', 'ra']).toContain(r.tier);
    }
  });

  it('toute stat présente dans le catalogue a une rune simple', () => {
    const statsCatalogue = new Set(items.flatMap((it) => it.stats.map((s) => s.statId)));
    const avecSimple = new Set(runes.filter((r) => r.tier === 'simple').map((r) => r.statId));
    expect([...statsCatalogue].filter((s) => !avecSimple.has(s))).toEqual([]);
  });

  it('Pa = 3× et Ra = 10× la rune simple de la même stat', () => {
    for (const r of runes) {
      if (r.tier === 'simple') continue;
      const simple = runes.find((s) => s.statId === r.statId && s.tier === 'simple');
      expect(simple, `rune simple manquante pour ${r.nom}`).toBeDefined();
      expect(r.valeur / simple!.valeur).toBe(r.tier === 'pa' ? 3 : 10);
    }
  });

  it('une seule rune par (stat, tier)', () => {
    const vus = new Set<string>();
    for (const r of runes) {
      const k = `${r.statId}/${r.tier}`;
      expect(vus.has(k), `doublon ${k} (${r.nom})`).toBe(false);
      vus.add(k);
    }
  });
});
