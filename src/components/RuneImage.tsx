import { useState } from 'react';
import { STAT_BY_ID, type StatFamille } from '../data/statMapping.ts';
import type { RuneDef } from '../data/types.ts';

/** Couleur de pierre par famille de caractéristique (repli SVG uniquement). */
const COULEURS: Record<StatFamille, string> = {
  action: '#7c3aed',
  dommages: '#dc2626',
  resistances: '#2563eb',
  retrait: '#0891b2',
  primaire: '#d97706',
  secondaire: '#059669',
};

/** Pierre runique dessinée en SVG : abréviation + couleur de famille, marque Pa/Ra. */
export function svgRune(rune: RuneDef): string {
  const stat = STAT_BY_ID[rune.statId];
  const couleur = COULEURS[stat.famille];
  const abbr = stat.abbr.length > 4 ? stat.abbr.slice(0, 4) : stat.abbr;
  const taille = abbr.length > 3 ? 13 : 16;
  const marque = rune.tier === 'pa' ? 'Pa' : rune.tier === 'ra' ? 'Ra' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
<path d="M24 3l18 10v22L24 45 6 35V13z" fill="${couleur}" stroke="#0006" stroke-width="2"/>
<path d="M24 8l13 7v18l-13 7-13-7V15z" fill="#fff2"/>
<text x="24" y="${marque ? 26 : 29}" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="${taille}" fill="#fff">${abbr}</text>
${marque ? `<text x="24" y="40" text-anchor="middle" font-family="Arial,sans-serif" font-weight="bold" font-size="10" fill="#fffc">${marque}</text>` : ''}
</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function RuneImage({ rune, taille = 32, className = '' }: { rune: RuneDef; taille?: number; className?: string }) {
  const [erreur, setErreur] = useState(false);
  const repli = erreur || rune.imageLocale.includes('placeholder');
  return (
    <img
      src={repli ? svgRune(rune) : rune.imageLocale}
      alt=""
      width={taille}
      height={taille}
      loading="lazy"
      decoding="async"
      onError={() => setErreur(true)}
      className={`shrink-0 rounded ${className}`}
      style={{ width: taille, height: taille }}
    />
  );
}
