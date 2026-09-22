import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item } from '../data/types.ts';
import { placeholderPour } from '../data/statMapping.ts';
import { FILTRES_VIDES, type FiltresRecherche } from '../search/index.ts';
import { useCatalogue } from '../store/catalogue.ts';
import { ItemImage } from './ItemImage.tsx';
import { ChampNombre } from './ChampNombre.tsx';

const LIMITE = 40;

export function RechercheObjet({ onChoisir }: { onChoisir: (item: Item) => void }) {
  const index = useCatalogue((s) => s.index);
  const [requete, setRequete] = useState('');
  const [filtres, setFiltres] = useState<FiltresRecherche>(FILTRES_VIDES);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listeRef = useRef<HTMLUListElement>(null);

  const filtresActifs = filtres.type !== null || filtres.niveauMin !== null || filtres.niveauMax !== null;

  const resultats = useMemo(() => {
    if (!index) return [];
    if (requete.trim() === '' && !filtresActifs) return [];
    return index.rechercher(requete, filtres, LIMITE);
  }, [index, requete, filtres, filtresActifs]);

  useEffect(() => setActif(0), [resultats]);

  // Garde l'élément actif visible dans la liste.
  useEffect(() => {
    listeRef.current?.children[actif]?.scrollIntoView({ block: 'nearest' });
  }, [actif]);

  const choisir = (item: Item) => {
    onChoisir(item);
    setRequete('');
    setOuvert(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!ouvert || resultats.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActif((a) => Math.min(a + 1, resultats.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActif((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choisir(resultats[actif]);
    } else if (e.key === 'Escape') {
      setOuvert(false);
    }
  };

  const setNiveau = (champ: 'niveauMin' | 'niveauMax') => (v: number | null) =>
    setFiltres((f) => ({ ...f, [champ]: v }));

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="search"
          value={requete}
          placeholder={index ? `Rechercher parmi ${index.taille} objets… (nom, accents ignorés)` : 'Chargement…'}
          disabled={!index}
          onChange={(e) => {
            setRequete(e.target.value);
            setOuvert(true);
          }}
          onFocus={() => setOuvert(true)}
          onBlur={() => setTimeout(() => setOuvert(false), 150)}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={ouvert && resultats.length > 0}
          aria-controls="resultats-recherche"
          aria-autocomplete="list"
          className="champ h-9 min-w-[16rem] flex-1 px-3"
        />
        <select
          value={filtres.type ?? ''}
          onChange={(e) => {
            setFiltres((f) => ({ ...f, type: e.target.value || null }));
            setOuvert(true);
          }}
          className="champ h-9"
          aria-label="Filtrer par type"
        >
          <option value="">Tous types</option>
          <option value="Arme">Toutes armes</option>
          {index?.types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <span className="flex items-center gap-1 text-xs text-encre-2">
          Niv.
          <ChampNombre value={filtres.niveauMin} onChange={setNiveau('niveauMin')} vide placeholder="min" className="w-16" aria-label="Niveau minimum" />
          –
          <ChampNombre value={filtres.niveauMax} onChange={setNiveau('niveauMax')} vide placeholder="max" className="w-16" aria-label="Niveau maximum" />
        </span>
      </div>

      {ouvert && resultats.length > 0 && (
        <ul
          id="resultats-recherche"
          ref={listeRef}
          role="listbox"
          className="carte absolute z-20 mt-1 max-h-96 w-full overflow-y-auto shadow-lg"
        >
          {resultats.map((item, i) => (
            <li
              key={item.id}
              role="option"
              aria-selected={i === actif}
              onMouseDown={(e) => {
                e.preventDefault();
                choisir(item);
              }}
              onMouseEnter={() => setActif(i)}
              className={`flex cursor-pointer items-center gap-2 px-2 py-1 text-sm ${
                i === actif ? 'bg-accent-doux' : ''
              }`}
            >
              <ItemImage src={item.imageLocale} alt="" fallback={placeholderPour(item.type, item.famille)} taille={28} />
              <span className="min-w-0 flex-1 truncate">{item.nom}</span>
              <span className="tnum text-xs text-encre-2">niv. {item.niveau}</span>
              <span className="w-24 truncate text-right text-xs text-encre-2">{item.type}</span>
            </li>
          ))}
          {resultats.length === LIMITE && (
            <li className="px-2 py-1 text-xs text-encre-2">Affine ta recherche pour voir plus de résultats.</li>
          )}
        </ul>
      )}
      {ouvert && resultats.length === 0 && (requete.trim() !== '' || filtresActifs) && index && (
        <div className="carte absolute z-20 mt-1 w-full px-3 py-2 text-sm text-encre-2 shadow-lg">
          Aucun objet trouvé.
        </div>
      )}
    </div>
  );
}
