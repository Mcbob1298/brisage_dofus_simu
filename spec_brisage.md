# Projet — Simulateur de rentabilité du brisage (Dofus 3)

Construis une application web locale qui calcule si briser un équipement Dofus est
rentable, à partir d'un catalogue complet des objets du jeu et d'une liste de prix de
runes que je tiens à jour moi-même.

Je suis développeur mobile (Flutter/Kotlin), à l'aise avec le code : va droit au but,
pas besoin de m'expliquer les bases. Travaille par étapes, dans l'ordre du §9, et
arrête-toi après chaque étape pour que je valide.

---

## 1. Stack

- **Vite + React + TypeScript + Tailwind CSS**, pas de backend, pas de base de données.
- Tout est statique : déployable sur Netlify / Vercel / GitHub Pages.
- Persistance en `localStorage` uniquement, avec export/import JSON.
- Pas de dépendance lourde. `zustand` ou un simple contexte React suffit pour l'état.
- `vitest` pour les tests du moteur de calcul (obligatoire, voir §8).

---

## 2. Données du jeu — à récupérer au build, pas au runtime

Le catalogue d'objets doit être **téléchargé par un script Node lancé à la main**
(`npm run sync-data`), qui écrit des fichiers statiques dans `public/data/` et
`public/img/`. L'app ne fait **aucun appel réseau au runtime**.

### API candidates — vérifie laquelle est vivante et la plus complète avant de coder

Ne me fais pas confiance sur les URLs exactes, je n'ai pas pu les tester : teste-les
toi-même avec `curl` et adapte.

1. **DofusDude / doduapi** — la référence pour Dofus 3.
   - Docs : `https://docs.dofusdu.de`
   - Base probable : `https://api.dofusdu.de/dofus3/v1/fr/items/equipment`
   - Pagination via `page[size]` / `page[number]`, recherche via `/search?query=`
   - Images d'objets servies par la même API
   - Dépôts liés : `github.com/dofusdude/doduda`, `github.com/dofusdude/dofus3-main`
2. **DofusDB** — `https://api.dofusdb.fr/items?$limit=50&lang=fr` (API Feathers,
   pagination `$skip`/`$limit`), images sous `https://api.dofusdb.fr/img/items/<iconId>.png`
3. **Datafus** (`github.com/bot4dofus/Datafus`) — dumps JSON bruts sur GitHub, en secours
   si les deux API sont mortes.

Si aucune ne répond, dis-le-moi au lieu d'inventer un jeu de données.

### Ce qu'il faut extraire, par objet

```ts
type Item = {
  id: number;
  nom: string;
  niveau: number;
  type: string;          // Coiffe, Cape, Anneau, Amulette, Bottes, Ceinture,
                         // Bouclier, Arme (préciser le sous-type), Trophée, Dofus…
  imageLocale: string;   // chemin vers l'icône téléchargée, ex. "/img/items/12345.webp"
  stats: {
    statId: StatId;      // mappé sur MON référentiel du §3, pas sur celui de l'API
    min: number;         // borne basse du jet
    max: number;         // borne haute du jet
  }[];
  panoplieId?: number;
  recetteConnue?: boolean;
  droppable?: boolean;   // si l'info existe : sert à flaguer les mauvaises cibles
};
```

**Ne garde que les objets équipables** (ceux qui passent au concasseur) : coiffes,
capes, anneaux, amulettes, bottes, ceintures, boucliers, armes, trophées, dofus,
familiers exclus. Objectif : quelques milliers d'entrées, pas 20 000.

### Images — point critique

- **Télécharge les icônes en local** pendant `sync-data`, convertis-les en **WebP 48×48**
  (via `sharp`), et sers-les depuis `public/img/`. Le poids total doit rester sous ~15 Mo.
- Si l'API ne fournit pas d'icône pour un objet, génère un placeholder SVG par type
  d'objet (silhouette de coiffe, cape, anneau…) — jamais d'image cassée.
- Le mapping `statId` de l'API vers mon référentiel doit être **explicite et testé** :
  écris-le dans un fichier dédié `src/data/statMapping.ts`, et **loggue toute
  caractéristique non mappée** pendant le sync pour que je puisse compléter.

---

## 3. Le moteur de calcul — la partie à ne pas rater

### Formule du brisage

Pour chaque ligne de caractéristique de l'objet, le concasseur restitue un nombre de
**points de caractéristique** :

```
points = jet × poids_unitaire × niveau_objet × 0,015 × (coefficient / 100) ÷ poids_rune
```

Comme le poids de la rune simple est égal au poids unitaire de la caractéristique, ça se
réduit pour un brisage sans focus à :

```
points = jet × niveau_objet × 0,015 × (coefficient / 100)
```

**Cas de contrôle obligatoire (test unitaire) :** objet niveau 65, ligne « 10 % Critique »
(poids unitaire 10), coefficient 100 % → `10 × 10 × 65 × 0,015 ÷ 10 = 9,75`, soit les ~10
runes Cri effectivement rapportées en jeu. Un objet niveau 130 dans les mêmes conditions
doit donner ~19,5. Coefficient 200 % → le double. La relation est strictement linéaire en
niveau et en coefficient.

> **Correction du 2026-09-26 — plancher par ligne.** La formule ci-dessus est incomplète :
> il manque un terme constant de **+ 1 sur le poids de chaque ligne**, avant application du
> coefficient et conversion en runes :
>
> ```
> poids_ligne = jet × poids_unitaire × niveau_objet × 0,015 + 1
> points      = poids_ligne × (coefficient / 100) ÷ poids_unitaire
> ```
>
> Le poids d'une rune simple valant son poids unitaire, ce « + 1 » garantit **une rune par
> ligne à 100 % de coefficient**. Le cas de contrôle devient donc **9,85** et non 9,75, et
> le rendement n'est plus strictement linéaire en niveau (le plancher, lui, est constant) —
> il le reste en coefficient. Trois sources concordantes contre la rédaction initiale :
>
> - https://github.com/KamelAkar/Calculateur_Brisage_Dofus →
>   `poids = ((value * poids_rune * level * 0.0150) + 1)` ;
> - https://papycha.fr/taux-de-brisage/ → poids de ligne = Stat × Poid_u, puis + 1 ;
> - DoFocus, Draconiros, 2026-09-26 : Arc de Chasse (niveau 1, ligne « Arme de chasse » sans
>   valeur, coefficient 15 %) affiche 0,03 rune soit 266 kamas. Le plancher seul rend
>   `1 × 0,15 ÷ 5 = 0,03` ✓ ; la formule sans plancher rendait 0.
>
> **Confirmé en jeu le 2026-09-26** : le brisage de Baguettes de Liriel a rendu des Runes
> Chas, alors que leur ligne « Arme de chasse » n'a aucune valeur. Sans plancher cette ligne
> ne rendrait rien — le plancher existe donc bel et bien.
>
> **La constante 0,015 est elle aussi mesurée depuis le 2026-09-26** : 4 Scaracoiffes Dorées
> (niveau 58) brisées en focus % Critique à 42 % de coefficient ont rendu **12 Runes Cri**.
> Le modèle prédit 10,5 à 13,2 selon les jets (12,9 aux jets moyens). Une constante de 0,01
> donnerait 8,8 runes, 0,02 en donnerait 17 : le relevé les exclut. Comme l'objet porte six
> lignes de poids 1, 3, 6, 10 et 30, ce contrôle valide aussi la table des poids et la règle
> des 50 % au focus. Voir le test « ancrage sur un brisage réel ».
>
> L'écart est négligeable en haut niveau (+1 % au-dessus du niveau 100) mais décisif en bas
> niveau : **+71 % de valeur médiane sur les objets de niveau 1 à 20**, +10 % de 21 à 50.
> Le test d'ancrage `reproduit le relevé DoFocus de l'Arc de Chasse` verrouille ce cas.

### Focus

Le focus détruit toutes les autres lignes et n'en reverse que **50 % du poids** sur la
rune ciblée :

```
poids_effectif_focus = (jet_focus × poids_focus) + (Σ des autres jet × poids) / 2
points = poids_effectif_focus × niveau × 0,015 × (coef/100) ÷ poids_unitaire_focus
```

Les autres lignes ne rendent **rien**.

### Conversion points → runes

Une rune Pa vaut 3 points de la caractéristique, une rune Ra en vaut 10 (et pèse 3× et
10× le poids unitaire). Toutes les caractéristiques n'ont pas de Pa ni de Ra (voir table).

Trois modes de répartition à proposer, au choix de l'utilisateur :
- `greedy` (**défaut**) — Ra, puis Pa, puis simples. L'hypothèse la plus proche du
  comportement observé en jeu.
- `valeurMax` — sac-à-dos entier qui maximise les kamas selon mes prix. Borne haute
  théorique, à afficher comme telle.
- `toutSimple` — tout en runes simples.

La partie décimale n'est **pas** une rune garantie : c'est une probabilité d'obtenir une
rune de plus. Affiche-la comme telle (« 70 % de chance d'une Cri supplémentaire »), et
utilise l'espérance mathématique quand on simule un lot de N objets.

### Table des poids — valeurs de départ, toutes éditables par l'utilisateur

| Caractéristique | Poids unitaire | Pa | Ra |
|---|---|---|---|
| PA | 100 | — | — |
| PM | 90 | — | — |
| Portée | 51 | — | — |
| Invocation | 30 | — | — |
| Dommages | 20 | — | — |
| % Dommages Armes / Distance / Mêlée / Sorts | 15 | — | — |
| Soins | 10 | ✓ | — |
| % Critique | 10 | — | — |
| Renvoi de dommages | 10 | — | — |
| Retrait PA / PM | 7 | ✓ | — |
| Esquive PA / PM | 7 | ✓ | — |
| % Résistance élémentaire (×5) | 6 | — | — |
| Dommages élémentaires (×5) | 5 | ✓ | — |
| Dommages Critiques / Poussée / Piège | 5 | ✓ | — |
| Arme de chasse | 5 | — | — |
| Tacle / Fuite | 4 | ✓ | — |
| Prospection | 3 | ✓ | — |
| Sagesse | 3 | ✓ | ✓ |
| Puissance / Puissance Piège | 2 | ✓ | ✓ |
| Résistance fixe (×5) / Ré Critiques / Ré Poussée | 2 | ✓ | — |
| Force / Intelligence / Chance / Agilité | 1 | ✓ | ✓ |
| Vitalité | 0,25 | ✓ | ✓ |
| Pods | 0,25 | ✓ | ✓ |
| Initiative | 0,1 | ✓ | ✓ |

Source : tables communautaires 2026 (`dafous.app/guides/poids-runes-fm.html`).
**Attention, il y a des désaccords connus entre sources** : la Vitalité est donnée à 0,25
ou 0,2 selon les auteurs, les Ré Critiques / Ré Poussée à 2 ou 5. C'est pour ça que la
colonne « poids » doit rester modifiable dans l'interface, avec un bouton de remise à zéro.

### Sorties du moteur

Pour un objet + un coefficient + une stratégie de focus :
- liste des runes obtenues (type, dénomination, quantité, reste fractionnaire)
- valeur brute, valeur nette après taxe de vente configurable
- bénéfice net = valeur nette − prix de revient, et ROI en %
- **coefficient seuil de rentabilité** : le coefficient en dessous duquel on brise à
  perte (recherche dichotomique entre 1 % et 4000 %). C'est le chiffre le plus utile de
  tout le site : c'est ce que je compare à ce que m'affiche le concasseur.

---

## 4. Écran « Objet »

- **Barre de recherche** en haut, avec autocomplétion sur tout le catalogue :
  résultats affichés avec **l'icône de l'objet**, son nom, son niveau et son type.
  Recherche insensible aux accents et à la casse, tolérante aux fautes (fuzzy léger),
  filtrable par type et par tranche de niveau. Doit rester fluide sur plusieurs milliers
  d'entrées (index construit une fois, pas de `filter()` sur toute la liste à chaque frappe).
- À la sélection : les **caractéristiques de base de l'objet se remplissent
  automatiquement**. C'est le cas d'usage normal — je ne veux pas saisir les lignes à la
  main.
- Les jets étant des fourchettes (« 20 à 40 Vitalité »), propose un sélecteur global
  **Jet min / moyen / max**, avec **max par défaut** (c'est ce qu'on vise en craft).
  Chaque ligne reste individuellement modifiable si j'ai un objet avec un jet particulier,
  et un bouton remet les valeurs de base.
- Champs à part : coefficient (%), prix de revient unitaire, nombre d'objets du lot,
  taxe de vente (%).
- Case à cocher par ligne pour choisir le focus, ou aucun.

---

## 5. Écran « Prix des runes » — à simplifier au maximum

C'est le point que je veux le plus simple possible :

- **Une ligne par rune, avec l'image de la rune** et un seul champ : le prix.
- Les runes sont des objets du jeu (« Rune Fo », « Pa Fo », « Ra Fo »…) : récupère leurs
  icônes pendant le sync, avec le même pipeline que les objets. Si les images de runes ne
  sont pas récupérables, dessine-les en SVG : une pierre runique avec l'abréviation
  (Vi, Fo, Sa, Cri…) et une couleur par famille de caractéristique — jamais de case vide.
- Par défaut, **n'affiche que les runes concernées par l'objet sélectionné**. Un onglet
  « Toutes les runes » donne accès au reste, avec une recherche.
- Saisie confortable : `Tab` passe au champ suivant, formatage automatique des milliers,
  sauvegarde immédiate en `localStorage`.
- Bouton **Exporter / Importer** la liste de prix en JSON, pour que je puisse la
  sauvegarder ou la réutiliser ailleurs.
- Affiche la **date de dernière mise à jour de chaque prix**, et signale en orange ceux
  qui datent de plus de 15 jours. Les prix des runes bougent, je dois voir lesquels sont
  périmés.

---

## 6. Écran « Comparateur de focus »

Pour l'objet en cours, calcule et classe par bénéfice net : le brisage naturel, puis un
focus sur chacune des lignes. Indique le gagnant. C'est ce qui décide de la façon de
briser.

---

## 7. Écran « Explorateur » — la fonctionnalité qui a le plus de valeur

Avec mes prix de runes, calcule pour **tous les objets du catalogue** la valeur théorique
des runes à coefficient 100 %, et classe-les.

- Colonnes : objet (avec icône), niveau, type, valeur des runes à 100 %, meilleure
  stratégie de focus, valeur au meilleur focus.
- Filtres : tranche de niveau, type d'objet, valeur minimale.
- Colonne optionnelle « valeur des runes ÷ niveau », pour repérer les objets denses.
- Si l'info « droppable » est disponible dans les données, permets de **masquer les objets
  droppables** : ce sont de mauvaises cibles, les joueurs les brisent par flemme et écrasent
  leur coefficient.

Le prix d'achat en HDV n'est disponible dans aucune API (il dépend du serveur), donc
l'explorateur classe sur la **valeur produite**, pas sur la marge. Permets-moi de saisir à
la main un prix constaté sur un objet pour le basculer dans le simulateur complet.

### Journal des coefficients

Petit module : pour un objet donné, je note le coefficient lu en jeu avec la date.
Historique conservé en `localStorage`, affiché en courbe. Le coefficient chute quand les
joueurs brisent et remonte quand l'objet est délaissé — voir sa tendance vaut de l'or.

---

## 8. Tests

`vitest` sur le moteur uniquement, mais sérieusement :
- le cas de contrôle niveau 65 / 10 % critique / coef 100 % → 9,85 (cf. correction §3)
- linéarité en niveau et en coefficient
- focus : vérifier que les autres lignes ne produisent rien et que la moitié de leur poids
  est bien transférée
- conversion points → runes dans les trois modes, y compris les restes
- recherche du coefficient seuil : le bénéfice doit être nul au seuil, positif juste au-dessus
- mapping des caractéristiques de l'API : aucune caractéristique inconnue dans le catalogue final

---

## 9. Étapes — arrête-toi après chacune

1. Init du projet, script `sync-data` qui interroge l'API retenue, catalogue JSON + images
   WebF en local. Montre-moi combien d'objets et d'images ont été récupérés, et la liste
   des caractéristiques non mappées.
2. Moteur de calcul pur (`src/engine/`, aucune dépendance UI) + tests du §8 qui passent.
3. Écran Objet : recherche avec images, remplissage automatique des stats, champs annexes.
4. Écran Prix des runes avec images, persistance, export/import.
5. Résultats : butin, bilan, coefficient seuil, comparateur de focus.
6. Explorateur + journal des coefficients.

---

## 10. Interface

- Dense et lisible, pensée pour être **utilisée**, pas contemplée : c'est un outil de
  travail que j'ouvre à côté du jeu.
- Mode sombre et mode clair, suivant le réglage système, avec bascule manuelle.
- Chiffres en police à chasse fixe et `font-variant-numeric: tabular-nums` partout où ils
  s'alignent en colonnes.
- Kamas formatés en français avec espaces, abrégés en `k` et `M` au-delà de 10 000.
- Le bénéfice net et le coefficient seuil doivent être lisibles d'un coup d'œil, en haut
  de page, toujours visibles.
- Responsive : utilisable sur téléphone, même si le poste de travail est le desktop.
- Aucune donnée d'exemple présentée comme réelle : si tu pré-remplis quelque chose au
  premier lancement, marque-le clairement comme exemple.

---

## 11. Ce qu'il ne faut pas faire

- Ne pas inventer de valeurs de poids ou de formule « qui semblent correctes » : tout ce
  qui n'est pas dans ce document doit être vérifié sur une source réelle, et la source
  citée en commentaire dans le code.
- Ne pas présenter les modes de répartition des runes comme certains : la répartition
  exacte entre Ra, Pa et simples n'est documentée nulle part publiquement.
- Ne pas appeler d'API au runtime : le site doit fonctionner hors ligne une fois chargé.
- **Ne jamais projeter une mesure au-delà de ce qu'elle couvre.** Un coefficient est relevé
  avant le premier brisage, et briser le fait baisser. Multiplier une marge unitaire par le
  budget entier produit un plafond théorique, jamais une prévision : l'interface doit
  conseiller un premier lot borné par la part de budget qu'on accepte de risquer, dire de
  relire le coefficient après, et afficher le chiffre budget entier comme hypothèse
  explicite. Même prudence pour les prix : un prix HDV est un relevé unique, acheter en
  masse vide les lots les moins chers et fait monter le prix réel.
- Ne pas stocker les prix ailleurs que dans le navigateur.

---

## Sources vérifiées

- Poids des runes 2026 — https://dafous.app/guides/poids-runes-fm.html
- Mécanique du focus et exemples chiffrés — https://www.dofus.com/fr/forum/1003-divers/2294225-brisage-question
- Coefficient de brisage — https://www.dofus.com/fr/forum/1782-dofus/2366805-clarification-coefficient-brisage
- Constante 0,0150 dans un calculateur existant — https://github.com/KamelAkar/Calculateur_Brisage_Dofus
- Formule niveau × poids × coefficient — https://papycha.fr/taux-de-brisage/