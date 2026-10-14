# Motus (jeu familial)

Jeu inspiré de « Motus » (France 2), pour des repas de famille.

- Écran TV : navigateur Silk d'un Amazon Fire TV Stick (`?mode=tv`).
- Manette : navigateur d'un téléphone (`?mode=manette`).
- Connexion directe TV ↔ téléphone via PeerJS (WebRTC). Pas de serveur à nous.
- Site statique hébergé gratuitement sur GitHub Pages.
- Architecture, stack et connexion reprises de « La Roue de la Fortune » (github.com/Sharurkan/roue-de-la-fortune). Copier ce qui marche déjà plutôt que le réécrire.

Spécification complète : @docs/SPEC.md

## Commandes

- `npm run dev` : serveur local
- `npm run build` : build de production
- `npm run typecheck` : vérification TypeScript
- `npm run lint` : ESLint
- `npm run format` : Prettier
- `npm run format:check` : vérification Prettier (lancée par la CI)
- `npm test` : Vitest
- `npm run check` : typecheck + lint + tests (à lancer avant chaque commit)
- `npm run words` : régénère les listes de mots depuis Lexique (outil local, pas lancé par la CI)

## Stack

- TypeScript strict, Vite, aucun framework UI
- PeerJS pour la connexion, `zod` (import `zod/mini`, plus léger) pour valider les messages reçus
- Vitest pour les tests, ESLint + Prettier pour le style
- Cible navigateur : ES2020 (le Fire TV Stick n'a pas un navigateur récent)
- Dépendances à versions fixes (pas de `^` ni `~`). Toute nouvelle dépendance doit être justifiée et validée par l'utilisateur.

## Architecture

```
src/
  game/       Règles pures : état, actions, reducer, config, scores, coloriage, loto, recherche de mots, normalisation
  game/words/ Listes de mots générées (mots secrets, mots acceptés) : jamais modifiées à la main
  protocol/   Types et schémas zod des messages TV ↔ téléphone (versionnés)
  net/        Connexion PeerJS : code de salle, envoi, réception, reconnexion (copié de la Roue)
  storage/    Sauvegarde locale (localStorage), avec gestion d'erreurs
  tv/         Vue TV : grille de lettres, grilles de loto, scores, chrono, sons, QR code, salle des téléphones
  phone/      Vue manette : clavier de lettres, saisie du mot, boutons
  shared/     Utilitaires communs (DOM sûr, lecture de l'URL)
  main.ts     Choix du mode selon l'URL
tools/        Scripts Node lancés à la main (génération du dictionnaire). Jamais livrés.
```

Règles de dépendance (à respecter strictement) :

- `game/` ne dépend de rien d'autre : ni DOM, ni réseau, ni `localStorage`, ni `Math.random`, ni `Date.now`.
- `protocol/` dépend seulement de `game/` (types) et de `zod`.
- `net/` ne connaît pas les règles du jeu. Il transporte des messages déjà typés.
- `tv/` et `phone/` assemblent le tout. Ils ne contiennent aucune règle du jeu.

Principes :

- Le reducer est la seule source de vérité : `reduce(state, action, deps) → { state, events }`.
- Les `events` (lettre rouge, mot trouvé, boule tirée, MOTUS, boule noire…) pilotent sons et animations.
- Le hasard, l'horloge et les listes de mots sont injectés via `deps`, pour des tests reproductibles.
- La TV détient l'état et les chronos. Le téléphone envoie des actions et reçoit une vue publique.
- Valeurs de jeu (points, temps, nombre d'essais, tailles des grilles, nombre de boules, longueurs de mots) dans `game/config.ts`, jamais en dur ailleurs.

## Listes de mots

- Générées par `tools/` à partir de Lexique 3.83, enregistrées dans `src/game/words/`. Le build n'a pas besoin du réseau.
- Une chaîne triée par longueur, recherche par dichotomie. Seule la longueur de la partie est chargée.
- Ne jamais modifier à la main : corriger le script (ou ses listes d'exclusion) et régénérer.
- Le dictionnaire vit seulement sur la TV.

## Règles de code

- `strict: true`, pas de `any`, pas de `as` sauf justification en commentaire
- Fonctions courtes, une responsabilité, noms explicites en anglais
- Langue : code, commentaires, noms de tests, messages de lint et commits en anglais
- Textes affichés (interface, messages, mots, README, docs) en français, centralisés dans un fichier par vue
- Pas de code mort, pas de `console.log` laissé dans le code livré
- Commentaires seulement pour expliquer un « pourquoi » non évident
- Unions discriminées pour les actions, les phases et les messages
- Toute erreur réseau ou de stockage est gérée et affichée simplement à l'écran

## Sécurité

- Tout message reçu est non fiable : validé avec zod, sinon ignoré
- Le reducer refuse toute action invalide pour la phase en cours
- Jamais d'`innerHTML` avec du texte variable. Utiliser `textContent` ou les helpers de `shared/`
- Le mot secret n'est jamais envoyé au téléphone avant d'être révélé sur la TV
- Les actions de test (mot forcé, boule forcée) ne sont acceptées qu'avec `&test`
- Un seul téléphone : une nouvelle connexion remplace l'ancienne. Un téléphone par équipe : la TV vérifie chaque action (`game/permissions.ts`)
- Pas de données personnelles, pas de secrets dans le code
- `npm audit` sans vulnérabilité haute ou critique

## Tests

- `game/` : couverture élevée, chaque règle de docs/SPEC.md a au moins un test
- Obligatoires : coloriage, validité, main qui passe, lettres bonus, génération des grilles (de nombreuses graines), tirage des boules, MOTUS (lignes, colonnes, deux diagonales), remise à neuf des grilles, scores, dernier mot, mot décisif, chrono et mot bonus de la Super partie, aucun mot répété
- `protocol/` : tests des schémas (messages valides et invalides)
- `game/text.ts` : tests de la normalisation de texte
- Listes de mots : longueurs, A–Z seulement, triées, sans doublon, chaque mot secret est accepté
- Écrire le test avant ou avec le code, jamais après coup « pour la forme »

## Workflow

- Avancer phase par phase (voir docs/SPEC.md, section « Phases »)
- Avant chaque phase : proposer un plan court et attendre la validation
- Après chaque phase : lancer `npm run check`, résumer (fait, reste, échoué, non vérifié), attendre la validation, puis commit
- Commits courts au format Conventional Commits (`feat:`, `fix:`, `test:`, `chore:`…)
- Pas de ligne `Co-Authored-By` dans les commits : seul l'utilisateur en est l'auteur
- Ne jamais `git push`, créer de dépôt ou modifier les réglages GitHub sans accord explicite
- Demander avant tout téléchargement autre que Lexique
- En cas de doute sur une règle du jeu : demander, ne pas inventer
- Signaler clairement tout ce qui n'a pas pu être vérifié (en particulier sur le Fire TV Stick)

## Style de réponse

- Répondre en anglais, court et simple
- Dire ce qui est fait, ce qui reste, et ce qui a échoué
