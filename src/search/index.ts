/**
 * Index de recherche construit une seule fois sur le catalogue.
 *
 * - Insensible aux accents et à la casse (noms normalisés).
 * - Fuzzy léger par bigrammes : un index inversé bigramme → objets ; un objet
 *   est candidat s'il partage assez de bigrammes avec la requête (tolère ~1
 *   faute pour un mot court, 2–3 pour un mot long).
 * - Classement : préfixe du nom > préfixe d'un mot > sous-chaîne > fuzzy,
 *   puis nom le plus court (correspondance la plus proche), niveau décroissant, nom.
 * - Filtres type / niveau appliqués sur les candidats seulement.
 */
import type { Item } from '../data/types.ts';
import { normaliser } from '../lib/normaliser.ts';

export type FiltresRecherche = {
  /** Type affiché exact (« Coiffe », « Épée »…), « Arme » pour toutes les armes, ou null. */
  type: string | null;
  niveauMin: number | null;
  niveauMax: number | null;
  /** Masquer les objets droppables (si l'info existe). */
  masquerDroppables?: boolean;
};

export const FILTRES_VIDES: FiltresRecherche = { type: null, niveauMin: null, niveauMax: null };

type Entree = { item: Item; nom: string; mots: string[]; bigrammes: Set<string> };

function bigrammes(s: string): Set<string> {
  const out = new Set<string>();
  const t = ` ${s} `;
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Nombre de bigrammes manquants tolérés selon la longueur de la requête. */
function tolerance(nbBigrammes: number): number {
  if (nbBigrammes <= 3) return 0;
  if (nbBigrammes <= 6) return 2;
  if (nbBigrammes <= 10) return 3;
  return 4;
}

export class IndexRecherche {
  private entrees: Entree[] = [];
  private parBigramme = new Map<string, number[]>();
  private parPrefixe = new Map<string, number[]>();
  readonly types: string[];

  constructor(items: readonly Item[]) {
    const types = new Set<string>();
    items.forEach((item, idx) => {
      const nom = normaliser(item.nom);
      const mots = nom.split(' ').filter(Boolean);
      const e: Entree = { item, nom, mots, bigrammes: bigrammes(nom) };
      this.entrees.push(e);
      types.add(item.type);
      for (const b of e.bigrammes) {
        let l = this.parBigramme.get(b);
        if (!l) this.parBigramme.set(b, (l = []));
        l.push(idx);
      }
      // Préfixe de 1 caractère de chaque mot, pour les requêtes très courtes.
      for (const m of mots) {
        const p = m[0];
        let l = this.parPrefixe.get(p);
        if (!l) this.parPrefixe.set(p, (l = []));
        if (l[l.length - 1] !== idx) l.push(idx);
      }
    });
    this.types = [...types].sort((a, b) => a.localeCompare(b, 'fr'));
  }

  get taille(): number {
    return this.entrees.length;
  }

  private passeFiltres(item: Item, f: FiltresRecherche): boolean {
    if (f.type !== null) {
      if (f.type === 'Arme' ? item.famille !== 'Arme' : item.type !== f.type) return false;
    }
    if (f.niveauMin !== null && item.niveau < f.niveauMin) return false;
    if (f.niveauMax !== null && item.niveau > f.niveauMax) return false;
    if (f.masquerDroppables && item.droppable === true) return false;
    return true;
  }

  /** Objets passant les filtres, sans requête textuelle (tri niveau desc, nom). */
  filtrer(f: FiltresRecherche, limite = Infinity): Item[] {
    const out: Item[] = [];
    for (const e of this.entrees) if (this.passeFiltres(e.item, f)) out.push(e.item);
    out.sort((a, b) => b.niveau - a.niveau || a.nom.localeCompare(b.nom, 'fr'));
    return out.length > limite ? out.slice(0, limite) : out;
  }

  rechercher(requete: string, f: FiltresRecherche = FILTRES_VIDES, limite = 50): Item[] {
    const q = normaliser(requete);
    if (q === '') return this.filtrer(f, limite);

    // 1. Candidats : par préfixe si 1 caractère, sinon par bigrammes partagés.
    const scores = new Map<number, number>();
    const qb = bigrammes(q);
    if (q.length === 1) {
      for (const idx of this.parPrefixe.get(q) ?? []) scores.set(idx, qb.size);
    } else {
      for (const b of qb) {
        const l = this.parBigramme.get(b);
        if (!l) continue;
        for (const idx of l) scores.set(idx, (scores.get(idx) ?? 0) + 1);
      }
    }
    const minCommuns = qb.size - tolerance(qb.size);

    // 2. Classement.
    type Cand = { item: Item; rang: number; score: number };
    const cands: Cand[] = [];
    for (const [idx, communs] of scores) {
      const e = this.entrees[idx];
      let rang: number;
      if (e.nom.startsWith(q)) rang = 0;
      else if (e.mots.some((m) => m.startsWith(q))) rang = 1;
      else if (e.nom.includes(q)) rang = 2;
      else if (communs >= minCommuns) rang = 3;
      else continue;
      if (!this.passeFiltres(e.item, f)) continue;
      // Le score de bigrammes ne départage que les correspondances floues.
      cands.push({ item: e.item, rang, score: rang === 3 ? communs / qb.size : 1 });
    }
    cands.sort(
      (a, b) =>
        a.rang - b.rang ||
        b.score - a.score ||
        a.item.nom.length - b.item.nom.length ||
        b.item.niveau - a.item.niveau ||
        a.item.nom.localeCompare(b.item.nom, 'fr'),
    );
    return cands.slice(0, limite).map((c) => c.item);
  }
}
