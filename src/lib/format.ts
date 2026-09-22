const fmtEntier = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const fmtDecimal = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1, minimumFractionDigits: 0 });

/** 12345 → « 12 345 » (espaces insécables fines, comme en français). */
export function formatNombre(n: number, decimales = 0): string {
  return decimales > 0
    ? new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales }).format(n)
    : fmtEntier.format(n);
}

/**
 * Kamas en français : entier avec espaces jusqu'à 10 000, puis abrégé
 * en « k » et « M » (12,3 k, 1,5 M). Signe conservé.
 */
export function formatKamas(n: number): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  const signe = n < 0 ? '−' : '';
  if (abs < 10_000) return `${signe}${fmtEntier.format(abs)}`;
  if (abs < 1_000_000) return `${signe}${fmtDecimal.format(abs / 1_000)} k`;
  return `${signe}${fmtDecimal.format(abs / 1_000_000)} M`;
}

export function formatPct(n: number, decimales = 0): string {
  return `${formatNombre(n, decimales)} %`;
}

/** Saisie utilisateur « 12 345 », « 12345 », « 12,5k » → nombre (NaN si vide/invalide). */
export function parseNombre(s: string): number {
  const t = s.replace(/[\s  ]/g, '').replace(',', '.').toLowerCase();
  if (t === '') return NaN;
  const m = t.match(/^(-?\d*\.?\d+)([km])?$/);
  if (!m) return NaN;
  const base = Number(m[1]);
  return m[2] === 'k' ? base * 1_000 : m[2] === 'm' ? base * 1_000_000 : base;
}

/** Date ISO → « 22/09/2026 ». */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR');
}

export function joursDepuis(iso: string, maintenant = Date.now()): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? Infinity : Math.floor((maintenant - t) / 86_400_000);
}
