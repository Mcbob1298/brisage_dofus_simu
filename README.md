# Brisage — simulateur de rentabilité (Dofus 3)

Application statique (Vite + React + TypeScript + Tailwind), sans backend : le catalogue
d'objets est téléchargé au build et tout l'état utilisateur vit dans `localStorage`.
Spécification complète : [spec_brisage.md](spec_brisage.md).

## Commandes

| Commande | Rôle |
|---|---|
| `npm install` | dépendances |
| `npm run sync-data` | télécharge le catalogue (DofusDude), les icônes WebP 48×48, le flag « droppable » et les drops détaillés — monstres, zones, taux, restrictions de niveau — (DofusDB) dans `public/data/` et `public/img/` ; logue les caractéristiques non mappées |
| `npm run dev` | serveur de développement sur **http://localhost:5174** (port fixe : le `localStorage` est lié à l'origine, donc au port — en changer ferait disparaître les prix saisis) |
| `npm test` | tests vitest (moteur, mapping sur les données synchronisées, index de recherche) |
| `npm run build` | `tsc --noEmit` + build de production dans `dist/` |

## Structure

- `scripts/sync-data.ts` — sync du catalogue (Node ≥ 22.6, TypeScript natif).
- `src/data/statMapping.ts` — référentiel des caractéristiques (`StatId`), mapping des effets API, effets ignorés, types conservés.
- `src/engine/` — moteur pur : formule du brisage, focus, conversion points → runes (3 modes), bilan, coefficient seuil, comparateur, évaluation du catalogue, recherche inverse par rune, estimation de prix, valeur de farm par monstre, recommandations selon le budget.
- `src/store/` — état zustand : catalogue, simulation, prix des runes, réglages (poids, mode), notes (journal des coefficients, prix constatés), thème.
- `src/components/CarteObjet.tsx` — carte de brisage : coûts, résultat, coefficient, détail des lignes avec et sans focus.
- `src/pages/` — Mon compte (budget, niveau, prospection → recommandations acheter / crafter / droper), Brisage (carte d'objet + détails repliés), Cibler une rune, Prix des runes, Prix des objets.

## Données persistées

`brisage.compte`, `brisage.simu`, `brisage.prix`, `brisage.reglages`, `brisage.notes`, `brisage.theme` dans le `localStorage` du navigateur.

Pendant `npm run dev` (et `npm run preview`), tout est recopié dans **`donnees/sauvegarde.json`** à chaque modification, et restauré au démarrage si le navigateur est vide : les données survivent à un changement de port, de navigateur ou à un vidage du cache. Ce fichier est ignoré par git par défaut ; retire `donnees/` du `.gitignore` pour les versionner. Un build statique n'a pas ce miroir : l'export/import manuel de l'onglet Mon compte prend le relais.
