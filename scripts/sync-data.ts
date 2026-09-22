/**
 * `npm run sync-data` — télécharge le catalogue d'objets et de runes depuis
 * DofusDude (https://docs.dofusdu.de), les icônes en WebP 48×48, et l'info
 * « droppable » depuis DofusDB (https://api.dofusdb.fr). Écrit tout dans
 * public/data/ et public/img/. L'app ne fait aucun appel réseau au runtime.
 *
 * Exécuté directement par Node ≥ 22.6 (type stripping natif) : ne pas utiliser
 * de syntaxe TS non effaçable (enum, parameter properties…).
 */
import { mkdir, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import {
  API_EFFECT_TO_STAT,
  IGNORED_EFFECTS,
  API_TYPE_TO_TYPE,
  API_RUNE_TYPE_ID,
  STAT_BY_ID,
  placeholderPour,
  type StatId,
} from '../src/data/statMapping.ts';
import type {
  Item,
  Monstre,
  DropItem,
  Panoplie,
  Classe,
  Condition,
  RuneDef,
  RuneTier,
  StatLine,
  EffectTypeReport,
  CatalogueMeta,
} from '../src/data/types.ts';

const DOFUSDUDE = 'https://api.dofusdu.de/dofus3/v1/fr';
// Les images ne sont pas préfixées par la langue.
const DOFUSDUDE_IMG = 'https://api.dofusdu.de/dofus3/v1/img/item';
const DOFUSDB = 'https://api.dofusdb.fr';
const PAGE_SIZE = 1000;
// L'endpoint /sets plafonne la taille de page à 500.
const PAGE_SIZE_SETS = 500;
const IMG_CONCURRENCY = 4;
const IMG_MAX_TENTATIVES = 6;
const IMG_SIZE = 48;

const ROOT = path.resolve(import.meta.dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'data');
const IMG_DIR = path.join(ROOT, 'public', 'img', 'items');

// ---------- Types bruts de l'API (sous-ensemble utilisé) ----------

type ApiEffect = {
  int_minimum: number;
  int_maximum: number;
  ignore_int_min: boolean;
  ignore_int_max: boolean;
  type: { name: string; id: number; is_meta: boolean; is_active: boolean };
  formatted: string;
};

type ApiItem = {
  ankama_id: number;
  name: string;
  type: { name: string; id: number };
  level: number;
  image_urls?: { icon?: string; sd?: string };
  effects?: ApiEffect[];
  recipe?: unknown[];
  parent_set?: { id: number; name: string };
};

type ApiPage = { _links: { next: string | null }; items: ApiItem[] };

// ---------- Utilitaires réseau ----------

async function fetchJson<T>(url: string, tentative = 1): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) {
    if (res.status >= 500 && tentative < 3) {
      await new Promise((r) => setTimeout(r, 1500 * tentative));
      return fetchJson<T>(url, tentative + 1);
    }
    throw new Error(`HTTP ${res.status} sur ${url}`);
  }
  return (await res.json()) as T;
}

async function fetchAllPages(endpoint: string, fields: string[]): Promise<ApiItem[]> {
  const items: ApiItem[] = [];
  for (let page = 1; ; page++) {
    const url =
      `${DOFUSDUDE}/items/${endpoint}?page[size]=${PAGE_SIZE}&page[number]=${page}` +
      `&fields[item]=${fields.join(',')}`;
    const data = await fetchJson<ApiPage>(url);
    if (!data.items?.length) break;
    items.push(...data.items);
    process.stdout.write(`  ${endpoint} : ${items.length} objets\r`);
    if (!data._links?.next) break;
  }
  process.stdout.write('\n');
  return items;
}

/** Pagination Feathers : $limit est plafonné à 50 côté serveur. */
async function fetchFeathers<T>(chemin: string, select: string[], filtre = ''): Promise<T[]> {
  const sel = select.map((x) => `$select[]=${encodeURIComponent(x)}`).join('&');
  const out: T[] = [];
  for (let skip = 0; ; skip += 50) {
    const url = `${DOFUSDB}/${chemin}?$limit=50&$skip=${skip}&${sel}${filtre}`;
    const d = await fetchJson<{ total: number; data: T[] }>(url);
    out.push(...d.data);
    process.stdout.write(`  ${chemin} : ${out.length}/${d.total}\r`);
    if (skip + 50 >= d.total || d.data.length === 0) break;
  }
  process.stdout.write('\n');
  return out;
}

/**
 * Codes de conditions d'équipement de DofusDB → caractéristique du référentiel.
 * Mapping établi le 2026-09-22 en recoupant `criterions` (DofusDB) avec le champ
 * `conditions` de DofusDude, qui nomme les éléments en clair :
 *   CP<12&CM<6&CW>99  ↔  PA < 12 & PM < 6 & Sagesse > 99   (La Baguette des Limbes)
 *   CS>99&CA>99&CV>99 ↔  Force > 99 & Agilité > 99 & Vitalité > 99  (Neuf Queues)
 *   CI<100&CC<100     ↔  Intelligence < 100 & Chance < 100  (Anneau Mèr)
 *   Pk<3              ↔  Bonus de panoplies < 3             (Obstructeur mineur)
 */
const CODE_CONDITION: Readonly<Record<string, StatId | 'panoplies'>> = {
  CP: 'pa',
  CM: 'pm',
  CW: 'sagesse',
  CS: 'force',
  CI: 'intelligence',
  CC: 'chance',
  CA: 'agilite',
  CV: 'vitalite',
  Pk: 'panoplies',
};

/**
 * Découpe la chaîne `criterions` en conditions exploitables.
 * Tout ce qui n'est pas dans CODE_CONDITION (quêtes, succès, alignement,
 * abonnement, kamas…) est signalé comme non vérifiable plutôt qu'ignoré.
 */
function parserConditions(criterions: string): { conditions: Condition[]; nonVerifiables: boolean } {
  const conditions: Condition[] = [];
  let nonVerifiables = false;
  if (!criterions) return { conditions, nonVerifiables };
  // Une alternative (|) ne se réduit pas à une contrainte simple : on ne tranche pas.
  if (criterions.includes('|')) return { conditions, nonVerifiables: true };
  for (const partie of criterions.split('&')) {
    const m = partie.trim().match(/^\(*([A-Za-z]{2})([<>])(-?\d+)\)*$/);
    if (!m) {
      nonVerifiables = true;
      continue;
    }
    const cible = CODE_CONDITION[m[1]];
    if (!cible) {
      nonVerifiables = true;
      continue;
    }
    const operateur = m[2] as '>' | '<';
    const valeur = Number(m[3]);
    if (cible === 'panoplies') conditions.push({ panoplies: true, operateur, valeur });
    else conditions.push({ statId: cible, operateur, valeur });
  }
  return { conditions, nonVerifiables };
}

/** Conditions d'équipement des objets du catalogue (DofusDB `criterions`). */
async function fetchConditions(): Promise<Map<number, { conditions: Condition[]; nonVerifiables: boolean }>> {
  const bruts = await fetchFeathers<{ id: number; criterions: string }>('items', ['id', 'criterions'], '&criterions[$ne]=');
  const out = new Map<number, { conditions: Condition[]; nonVerifiables: boolean }>();
  for (const b of bruts) {
    const parsed = parserConditions(b.criterions);
    if (parsed.conditions.length || parsed.nonVerifiables) out.set(b.id, parsed);
  }
  return out;
}

/** Les 19 classes du jeu. */
async function fetchClasses(): Promise<Classe[]> {
  const bruts = await fetchFeathers<{ id: number; shortName: { fr: string } }>('breeds', ['id', 'shortName']);
  return bruts
    .filter((b) => b.shortName?.fr)
    .map((b) => ({ id: b.id, nom: b.shortName.fr }))
    .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
}

// ---------- Panoplies (DofusDude) ----------

type ApiSet = {
  ankama_id: number;
  name: string;
  level: number;
  effects?: Record<string, ApiEffect[] | null>;
};

/** Bonus de panoplie par nombre de pièces, mappés sur le référentiel. */
async function fetchPanoplies(acc: EffectAccumulator): Promise<Panoplie[]> {
  const out: Panoplie[] = [];
  for (let page = 1; ; page++) {
    const url = `${DOFUSDUDE}/sets?page[size]=${PAGE_SIZE_SETS}&page[number]=${page}&fields[set]=effects`;
    const data = await fetchJson<{ _links: { next: string | null }; sets: ApiSet[] }>(url);
    if (!data.sets?.length) break;
    for (const s of data.sets) {
      const bonus: Panoplie['bonus'] = {};
      for (const [nb, effets] of Object.entries(s.effects ?? {})) {
        if (!effets?.length) continue;
        const lignes = mapEffects(effets, s.name, acc).map((l) => ({ statId: l.statId, valeur: l.max }));
        if (lignes.length) bonus[Number(nb)] = lignes;
      }
      if (Object.keys(bonus).length) out.push({ id: s.ankama_id, nom: s.name, niveau: s.level, bonus });
    }
    process.stdout.write(`  panoplies : ${out.length}\r`);
    if (!data._links?.next) break;
  }
  process.stdout.write('\n');
  return out;
}

// ---------- Drops (DofusDB) ----------

type ApiDrop = { objectId: number; percentDropForGrade1: number; criterions: string };
type ApiMonstre = {
  id: number;
  name: { fr: string };
  grades: { level: number }[];
  drops: ApiDrop[];
  subareas: number[];
  isBoss: boolean;
  isMiniBoss: boolean;
  isQuestMonster: boolean;
  hideInBestiary: boolean;
};

/** « PL>9&PL<111 » → niveau de joueur requis entre 10 et 110. */
function niveauxJoueur(criterions: string): { plMin?: number; plMax?: number } {
  const m = criterions?.match(/PL>(\d+)&PL<(\d+)/);
  if (!m) return {};
  return { plMin: Number(m[1]) + 1, plMax: Number(m[2]) - 1 };
}

/** Monstres lâchant au moins un équipement du catalogue, avec taux et zones. */
async function fetchMonstres(idsCatalogue: Set<number>): Promise<Monstre[]> {
  const [bruts, sousZones, zones] = await Promise.all([
    fetchFeathers<ApiMonstre>('monsters', ['id', 'name', 'grades.level', 'drops', 'subareas', 'isBoss', 'isMiniBoss', 'isQuestMonster', 'hideInBestiary']),
    fetchFeathers<{ id: number; areaId: number; name: { fr: string } }>('subareas', ['id', 'areaId', 'name']),
    fetchFeathers<{ id: number; name: { fr: string } }>('areas', ['id', 'name']),
  ]);
  const nomZone = new Map(zones.map((z) => [z.id, z.name?.fr ?? '']));
  const nomSousZone = new Map(
    sousZones.map((sz) => {
      const zone = nomZone.get(sz.areaId) ?? '';
      const nom = sz.name?.fr ?? '';
      return [sz.id, zone && zone !== nom ? `${zone} / ${nom}` : nom];
    }),
  );

  const out: Monstre[] = [];
  for (const m of bruts) {
    if (m.hideInBestiary) continue;
    const drops: DropItem[] = [];
    for (const d of m.drops ?? []) {
      if (!idsCatalogue.has(d.objectId) || !(d.percentDropForGrade1 > 0)) continue;
      drops.push({ itemId: d.objectId, taux: d.percentDropForGrade1, ...niveauxJoueur(d.criterions) });
    }
    if (drops.length === 0) continue;
    const niveaux = (m.grades ?? []).map((g) => g.level).filter(Number.isFinite);
    if (niveaux.length === 0) continue;
    out.push({
      id: m.id,
      nom: m.name?.fr ?? `#${m.id}`,
      niveau: Math.min(...niveaux),
      niveauMax: Math.max(...niveaux),
      boss: Boolean(m.isBoss),
      archimonstre: Boolean(m.isMiniBoss),
      zones: [...new Set((m.subareas ?? []).map((sz) => nomSousZone.get(sz)).filter((z): z is string => Boolean(z)))],
      drops: drops.sort((a, b) => b.taux - a.taux),
    });
  }
  return out.sort((a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom, 'fr'));
}

/** Ids Ankama des objets droppables selon DofusDB (`dropMonsterIds` non vide). */
async function fetchDroppableIds(): Promise<Set<number> | null> {
  const ids = new Set<number>();
  try {
    for (let skip = 0; ; ) {
      const url =
        `${DOFUSDB}/items?$limit=50&$skip=${skip}&$select[]=id` +
        `&dropMonsterIds.0[$exists]=true`;
      const data = await fetchJson<{ total: number; limit: number; data: { id: number }[] }>(url);
      for (const d of data.data) ids.add(d.id);
      skip += data.limit;
      process.stdout.write(`  DofusDB droppables : ${ids.size}/${data.total}\r`);
      if (skip >= data.total || data.data.length === 0) break;
    }
    process.stdout.write('\n');
    return ids;
  } catch (e) {
    process.stdout.write('\n');
    console.warn(`  ⚠ DofusDB indisponible (${(e as Error).message}) : champ "droppable" non renseigné.`);
    return null;
  }
}

// ---------- Mapping des effets ----------

type EffectAccumulator = Map<number, EffectTypeReport>;

function noteEffect(acc: EffectAccumulator, e: ApiEffect, itemName: string, statId?: StatId) {
  const status = statId ? 'mapped' : e.type.id in IGNORED_EFFECTS ? 'ignored' : 'unmapped';
  let rep = acc.get(e.type.id);
  if (!rep) {
    rep = { apiId: e.type.id, apiName: e.type.name, status, statId, count: 0, exemples: [] };
    acc.set(e.type.id, rep);
  }
  rep.count++;
  if (rep.exemples.length < 3 && !rep.exemples.includes(itemName)) rep.exemples.push(itemName);
}

function mapEffects(effects: ApiEffect[] | undefined, itemName: string, acc: EffectAccumulator): StatLine[] {
  const lines: StatLine[] = [];
  for (const e of effects ?? []) {
    const statId = API_EFFECT_TO_STAT[e.type.id];
    noteEffect(acc, e, itemName, statId);
    if (!statId) continue;
    // ignore_int_max = true → jet fixe (l'API met 0 dans int_maximum).
    const min = e.int_minimum;
    const max = e.ignore_int_max ? min : e.int_maximum;
    lines.push({ statId, min: Math.min(min, max), max: Math.max(min, max) });
  }
  return lines;
}

// ---------- Images ----------

/** Extrait l'id d'icône d'une URL du type ".../img/item/6007-64.png". */
function iconIdFromUrl(url: string | undefined): string | null {
  const m = url?.match(/\/item\/(\d+)-\d+\.png$/);
  return m ? m[1] : null;
}

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

let premiereErreurImage = false;

async function downloadIcon(iconId: string): Promise<boolean> {
  const dest = path.join(IMG_DIR, `${iconId}.webp`);
  if (await exists(dest)) return true;
  for (let tentative = 1; tentative <= IMG_MAX_TENTATIVES; tentative++) {
    try {
      const res = await fetch(`${DOFUSDUDE_IMG}/${iconId}-64.png`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429 || res.status >= 500) {
        // Rate limit : on respecte Retry-After si présent, sinon backoff exponentiel.
        const retryAfter = Number(res.headers.get('retry-after'));
        const attente = retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** tentative;
        await new Promise((r) => setTimeout(r, attente));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      await sharp(buf)
        .resize(IMG_SIZE, IMG_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toFile(dest);
      return true;
    } catch (e) {
      if (!premiereErreurImage) {
        premiereErreurImage = true;
        console.warn(`  ⚠ échec image ${iconId} : ${(e as Error).message}`);
      }
      return false;
    }
  }
  if (!premiereErreurImage) {
    premiereErreurImage = true;
    console.warn(`  ⚠ échec image ${iconId} : rate limit persistant après ${IMG_MAX_TENTATIVES} tentatives`);
  }
  return false;
}

async function downloadAllIcons(iconIds: string[]): Promise<Set<string>> {
  const ok = new Set<string>();
  let done = 0;
  const queue = [...iconIds];
  const worker = async () => {
    for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
      if (await downloadIcon(id)) ok.add(id);
      done++;
      if (done % 50 === 0 || done === iconIds.length) {
        process.stdout.write(`  images : ${done}/${iconIds.length}\r`);
      }
    }
  };
  await Promise.all(Array.from({ length: IMG_CONCURRENCY }, worker));
  process.stdout.write('\n');
  return ok;
}

// ---------- Runes ----------

function runeTier(nom: string): RuneTier {
  if (/^Rune Pa /.test(nom)) return 'pa';
  if (/^Rune Ra /.test(nom)) return 'ra';
  return 'simple';
}

// ---------- Main ----------

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  await mkdir(IMG_DIR, { recursive: true });

  console.log('▶ Téléchargement du catalogue DofusDude…');
  const rawEquip = await fetchAllPages('equipment', ['effects', 'recipe', 'parent_set']);
  const rawRes = await fetchAllPages('resources', ['effects']);

  console.log('▶ Drops (DofusDB)…');
  const droppableIds = await fetchDroppableIds();

  // --- Objets ---
  const effectAcc: EffectAccumulator = new Map();
  const excludedTypes = new Map<string, number>();
  const items: Item[] = [];
  const iconByItem = new Map<number, string>();

  for (const raw of rawEquip) {
    const tm = API_TYPE_TO_TYPE[raw.type.id];
    if (!tm) {
      excludedTypes.set(raw.type.name, (excludedTypes.get(raw.type.name) ?? 0) + 1);
      continue;
    }
    const iconId = iconIdFromUrl(raw.image_urls?.icon);
    if (iconId) iconByItem.set(raw.ankama_id, iconId);
    const item: Item = {
      id: raw.ankama_id,
      nom: raw.name,
      niveau: raw.level,
      type: tm.type,
      famille: tm.famille,
      imageLocale: placeholderPour(tm.type, tm.famille), // remplacé après téléchargement
      stats: mapEffects(raw.effects, raw.name, effectAcc),
    };
    if (raw.parent_set) item.panoplieId = raw.parent_set.id;
    item.recetteConnue = (raw.recipe?.length ?? 0) > 0;
    if (droppableIds) item.droppable = droppableIds.has(raw.ankama_id);
    items.push(item);
  }
  items.sort((a, b) => a.niveau - b.niveau || a.nom.localeCompare(b.nom, 'fr'));

  // --- Runes ---
  const runes: RuneDef[] = [];
  const runesIgnorees: string[] = [];
  const iconByRune = new Map<number, string>();
  for (const raw of rawRes) {
    if (raw.type.id !== API_RUNE_TYPE_ID) continue;
    const eff = (raw.effects ?? []).find((e) => API_EFFECT_TO_STAT[e.type.id]);
    if (!eff) {
      runesIgnorees.push(raw.name);
      continue;
    }
    const iconId = iconIdFromUrl(raw.image_urls?.icon);
    if (iconId) iconByRune.set(raw.ankama_id, iconId);
    const statId = API_EFFECT_TO_STAT[eff.type.id];
    runes.push({
      id: raw.ankama_id,
      nom: raw.name,
      statId,
      tier: runeTier(raw.name),
      // « Arme de chasse » n'a pas de valeur numérique dans l'API → 1 point.
      valeur: eff.int_minimum > 0 ? eff.int_minimum : 1,
      imageLocale: '/img/placeholder/rune.svg',
    });
  }
  const tierOrder: Record<RuneTier, number> = { simple: 0, pa: 1, ra: 2 };
  runes.sort(
    (a, b) =>
      STAT_BY_ID[a.statId].label.localeCompare(STAT_BY_ID[b.statId].label, 'fr') ||
      tierOrder[a.tier] - tierOrder[b.tier],
  );

  // --- Classes ---
  const classes = await fetchClasses();

  // --- Conditions d'équipement ---
  console.log("▶ Conditions d'équipement…");
  const conditions = await fetchConditions();
  for (const it of items) {
    const c = conditions.get(it.id);
    if (!c) continue;
    if (c.conditions.length) it.conditions = c.conditions;
    if (c.nonVerifiables) it.conditionsNonVerifiables = true;
  }

  // --- Panoplies ---
  console.log('▶ Panoplies…');
  const panoplies = await fetchPanoplies(effectAcc);

  // --- Drops ---
  console.log('▶ Drops détaillés (monstres, zones, taux)…');
  let monstres: Monstre[] = [];
  try {
    monstres = await fetchMonstres(new Set(items.map((i) => i.id)));
  } catch (e) {
    console.warn(`  ⚠ drops indisponibles (${(e as Error).message}) : le guide de farm sera vide.`);
  }

  // --- Images ---
  console.log('▶ Icônes (WebP 48×48)…');
  const allIconIds = [...new Set([...iconByItem.values(), ...iconByRune.values()])];
  const okIcons = await downloadAllIcons(allIconIds);
  for (const it of items) {
    const ic = iconByItem.get(it.id);
    if (ic && okIcons.has(ic)) it.imageLocale = `/img/items/${ic}.webp`;
  }
  for (const r of runes) {
    const ic = iconByRune.get(r.id);
    if (ic && okIcons.has(ic)) r.imageLocale = `/img/items/${ic}.webp`;
  }

  // --- Écriture ---
  const effectReport = [...effectAcc.values()].sort((a, b) => b.count - a.count);
  const meta: CatalogueMeta = {
    source: DOFUSDUDE,
    syncedAt: new Date().toISOString(),
    nbItems: items.length,
    nbRunes: runes.length,
    nbImages: okIcons.size,
    nbImagesEchouees: allIconIds.length - okIcons.size,
    droppableDisponible: droppableIds !== null,
  };
  await writeFile(path.join(DATA_DIR, 'items.json'), JSON.stringify(items));
  await writeFile(path.join(DATA_DIR, 'runes.json'), JSON.stringify(runes, null, 1));
  await writeFile(path.join(DATA_DIR, 'effect-types.json'), JSON.stringify(effectReport, null, 1));
  await writeFile(path.join(DATA_DIR, 'meta.json'), JSON.stringify(meta, null, 1));
  await writeFile(path.join(DATA_DIR, 'monstres.json'), JSON.stringify(monstres));
  await writeFile(path.join(DATA_DIR, 'panoplies.json'), JSON.stringify(panoplies));
  await writeFile(path.join(DATA_DIR, 'classes.json'), JSON.stringify(classes));

  // --- Rapport ---
  const unmapped = effectReport.filter((r) => r.status === 'unmapped');
  console.log('\n═══ Résumé ═══');
  console.log(`Objets API          : ${rawEquip.length}`);
  console.log(`Objets conservés    : ${items.length}`);
  console.log(
    `Types exclus        : ${[...excludedTypes.entries()].map(([t, n]) => `${t} (${n})`).join(', ')}`,
  );
  console.log(`Runes               : ${runes.length}${runesIgnorees.length ? ` (ignorées : ${runesIgnorees.join(', ')})` : ''}`);
  console.log(`Images              : ${okIcons.size}/${allIconIds.length} téléchargées`);
  console.log(`Droppable           : ${droppableIds ? `${items.filter((i) => i.droppable).length} objets flagués` : 'indisponible'}`);
  console.log(`Panoplies           : ${panoplies.length}`);
  console.log(`Classes             : ${classes.length}`);
  console.log(
    `Conditions          : ${items.filter((i) => i.conditions?.length).length} objets à conditions vérifiables, ${items.filter((i) => i.conditionsNonVerifiables).length} à conditions non vérifiables`,
  );
  console.log(
    `Monstres à drops    : ${monstres.length} (${monstres.reduce((n, m) => n + m.drops.length, 0)} couples monstre/objet, dont ${monstres.filter((m) => m.archimonstre).length} archimonstres)`,
  );
  console.log(`Sans aucune stat    : ${items.filter((i) => i.stats.length === 0).length} objets`);
  console.log(`Effets mappés       : ${effectReport.filter((r) => r.status === 'mapped').length}`);
  console.log(`Effets ignorés      : ${effectReport.filter((r) => r.status === 'ignored').length}`);
  if (unmapped.length) {
    console.log(`\n⚠ Caractéristiques NON MAPPÉES (${unmapped.length}) — à compléter dans src/data/statMapping.ts :`);
    for (const u of unmapped) {
      console.log(`  - #${u.apiId} « ${u.apiName} » ×${u.count}  ex : ${u.exemples.join(', ')}`);
    }
  } else {
    console.log('\n✔ Aucune caractéristique non mappée.');
  }
}

main().catch((e) => {
  console.error('✖ sync-data a échoué :', e);
  process.exit(1);
});
