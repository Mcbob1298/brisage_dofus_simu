import { useState } from 'react';

type Props = { src: string; alt: string; fallback?: string; taille?: number; className?: string };

/** Icône d'objet ; retombe sur un placeholder SVG si le fichier manque — jamais d'image cassée. */
export function ItemImage({ src, alt, fallback = '/img/placeholder/objet.svg', taille = 32, className = '' }: Props) {
  const [erreur, setErreur] = useState(false);
  return (
    <img
      src={erreur ? fallback : src}
      alt={alt}
      width={taille}
      height={taille}
      loading="lazy"
      decoding="async"
      onError={() => setErreur(true)}
      className={`shrink-0 rounded bg-fond-2 ${className}`}
      style={{ width: taille, height: taille, imageRendering: taille > 48 ? 'pixelated' : 'auto' }}
    />
  );
}
