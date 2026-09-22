# Brisage — simulateur de rentabilité (Dofus 3)

Application statique (Vite + React + TypeScript + Tailwind), sans backend : le catalogue
d'objets est téléchargé au build et tout l'état utilisateur vit dans `localStorage`.
Spécification complète : [spec_brisage.md](spec_brisage.md).

## Commandes

| Commande | Rôle |
|---|---|
| `npm install` | dépendances |
| `npm run sync-data` | télécharge le catalogue (DofusDude), les icônes WebP 48×48 et le flag « droppable » (DofusDB) dans `public/data/` et `public/img/` ; logue les caractéristiques non mappées |
| `npm run dev` | serveur de développement (http://localhost:5173) |
| `npm test` | tests vitest (moteur, mapping sur les données synchronisées, index de recherche) |
| `npm run build` | `tsc --noEmit` + build de production dans `dist/` |

## Structure

- `scripts/sync-data.ts` — sync du catalogue (Node ≥ 22.6, TypeScript natif).
- `src/data/statMapping.ts` — référentiel des caractéristiques (`StatId`), mapping des effets API, effets ignorés, types conservés.
- `src/engine/` — moteur pur : formule du brisage, focus, conversion points → runes (3 modes), bilan, coefficient seuil, comparateur, évaluation du catalogue.
- `src/store/` — état zustand : catalogue, simulation, prix des runes, réglages (poids, mode), notes (journal des coefficients, prix constatés), thème.
- `src/pages/` — Objet, Prix des runes, Comparateur, Explorateur.

## Données persistées (localStorage)

`brisage.simu`, `brisage.prix` (exportable/importable en JSON depuis l'écran Prix), `brisage.reglages`, `brisage.notes`, `brisage.theme`.
