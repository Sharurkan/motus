# Spécification

## But

Version familiale du jeu télévisé « Motus » (France 2, 1990–2019), pour des repas de famille.
Même architecture, même stack et même système de connexion que le jeu
« La Roue de la Fortune » (github.com/Sharurkan/roue-de-la-fortune), déjà validé sur le vrai matériel.

Priorités, dans l'ordre : fiable sur le Fire TV Stick et les téléphones, règles justes, code
propre et testé, puis visuels et sons.

Usage familial privé : pas de publicité, pas de compte, pas de serveur à nous.

## Matériel et usage

- La TV affiche le jeu via le navigateur Silk du Fire TV Stick, en plein écran 16:9 (`?mode=tv`).
- Les téléphones servent de manettes (`?mode=manette`).
- Deux modes, choisis au début de chaque partie (voir « Modes de jeu ») :
  - un seul téléphone sert de manette, on le passe à l'équipe dont c'est le tour ;
  - un téléphone par équipe.
- La TV et les téléphones sont sur le même Wi-Fi.
- Sur la TV, la seule interaction est un appui sur OK pour activer le son.

## Connexion

Identique à la Roue de la Fortune :

1. La TV ouvre `?mode=tv`. Elle génère un code de 4 lettres (sans lettres ambiguës comme I, L ou O).
2. Elle affiche ce code en grand, plus un QR code vers `?mode=manette&code=XXXX`.
3. Le téléphone scanne le QR code et se connecte tout seul.
4. Secours : ouvrir `?mode=manette` et taper le code.
5. Le téléphone garde le code et un identifiant aléatoire en mémoire. Il se reconnecte seul après une coupure et retrouve son équipe.
6. La TV garde le code et la partie en mémoire. Un rechargement ne perd rien.
7. Si le code est déjà pris sur le serveur PeerJS, réessayer puis générer un nouveau code.
8. États de connexion visibles des deux côtés : en attente, connecté, déconnecté, erreur.

Note : la mise en relation passe par le serveur public gratuit de PeerJS. Ensuite, les échanges sont directs (WebRTC).

## Modes de jeu

Identiques à la Roue de la Fortune :

- Le premier téléphone connecté est le **maître**. Il choisit le mode, et peut en changer entre deux parties.
- Un seul téléphone : une nouvelle connexion remplace l'ancienne. Le téléphone remplacé affiche « Un autre téléphone a pris la main » et ne se reconnecte plus seul (bouton « Reprendre la main »).
- Un téléphone par équipe (4 au plus) :
  - Chaque téléphone scanne le QR code et tape le nom de son équipe. Ordre de jeu : ordre d'arrivée.
  - La TV liste les équipes inscrites et leur état (connecté, déconnecté).
  - Le maître joue aussi pour son équipe. Il peut retirer une équipe inscrite par erreur, puis lance la partie (2 équipes au moins, dont la sienne).
  - Seule l'équipe dont c'est le tour peut jouer. Les autres téléphones voient « Ce n'est pas ton tour : c'est à X », boutons grisés.
  - Super partie : seule l'équipe finaliste joue.
  - Mot suivant, abandon, nouvelle partie : maître uniquement.
  - Téléphone de l'équipe active déconnecté : la TV l'indique, on attend sa reconnexion. Le maître peut aussi « Jouer à la place de X » pour ce tour.
- La TV garde le mode, le maître et les équipes. Un rechargement ne perd rien.

## Réglages de la partie (maître, à la configuration)

Valeurs par défaut et choix possibles dans `game/config.ts`.

- Mode : un seul téléphone ou un téléphone par équipe.
- Équipes : 2 à 4, noms saisis sur le téléphone (par défaut « Équipe 1 », …).
- Longueur des mots : 6 à 10 lettres, **7 par défaut**. Fixe pour toute la partie.
- Temps par essai : 20 s, 30 s, 45 s, 60 s ou sans limite. Par défaut : 30 s avec un téléphone par équipe, 45 s avec un seul téléphone (il faut le passer).
- Nombre de mots de la 1re partie : par défaut 10 (choix proposés : 6, 10, 14).

## Règles du jeu

### Équipes

- 2 à 4 équipes. Couleurs : jaune, bleu, vert, violet (le rouge est réservé aux lettres bien placées).
- L'équipe 1 (jaune) commence.
- Chaque équipe a un score, une grille de loto 5×5 et sa propre urne.

### Jouer un mot

- Au début de chaque mot, la TV affiche une grille vide de 6 lignes, avec la première lettre, plus une autre lettre à sa place (position tirée au hasard, jamais la première).
- L'équipe active tape un mot complet sur le téléphone. La première lettre est déjà remplie et bloquée.
- Chaque essai est minuté (voir « Réglages »). Compte à rebours visible sur la TV et sur le téléphone.
- Un essai valide s'écrit sur la ligne suivante, révélé lettre par lettre avec un son par lettre :
  - carré rouge : lettre bien placée ;
  - rond jaune : lettre présente mais mal placée ;
  - rien : lettre absente.
- Sur la ligne vide suivante, les lettres déjà connues comme bien placées sont affichées en indice. Le joueur tape quand même le mot entier.
- Mot trouvé : il s'affiche tout en rouge, l'équipe gagne 50 points (100 pour le dernier mot), puis tire des boules (voir « Grilles et boules »).
- Mot non trouvé après 6 essais, mot refusé ou temps écoulé : la main passe (voir « La main passe »).

### Coloriage (algorithme exact)

En deux passes, pour qu'une lettre ne soit jamais coloriée plus de fois qu'elle n'apparaît dans le mot secret :

1. Première passe : pour chaque position, si la lettre proposée est celle du mot secret, elle est rouge. Une occurrence de cette lettre est consommée.
2. Deuxième passe : pour chaque position qui n'est pas rouge, si la lettre a encore des occurrences non consommées dans le mot secret, elle est jaune et une occurrence est consommée. Sinon, elle est absente.

Exemple : mot secret `PAPIER`, proposition `PAPAYE` → P rouge, A rouge, P rouge, A absent (le seul A est déjà pris par le A rouge), Y absent, E jaune.

### Propositions valides

Une proposition est refusée si, après normalisation :

- elle n'a pas la bonne longueur (« Mauvaise longueur ») ;
- elle ne commence pas par la première lettre donnée (« Mauvaise première lettre ») ;
- elle n'est pas dans le dictionnaire des mots acceptés (« Mot inconnu »). Cela couvre les fautes d'orthographe, noms propres, mots composés et formes conjuguées autres que l'infinitif et les participes présent et passé ;
- elle a déjà été proposée sur ce mot (« Mot déjà proposé »).

Un mot refusé fait perdre la main, comme à la télé. La TV affiche la raison.

Normalisation (la même pour le dictionnaire, les mots secrets et la saisie) : majuscules, accents retirés (É → E, Ç → C), ligatures dépliées (Œ → OE, Æ → AE). Après normalisation, seules les lettres A à Z sont permises.

### La main passe

La main passe quand l'équipe active : rate ses 6 essais, propose un mot refusé, dépasse le temps, ou tire une boule noire.

- Mot refusé ou temps écoulé, pendant un mot : l'équipe suivante (dans l'ordre) reçoit une lettre bonus (une lettre pas encore connue, révélée à sa place, tirée au hasard). Elle joue ensuite les lignes qui restent sur le même mot.
- Après 6 essais ratés : l'équipe suivante reçoit une lettre bonus et un seul essai, écrit sur une ligne en plus sous la grille. Si elle échoue (mauvais mot, mot refusé ou temps écoulé : tout compte comme un essai raté), le mot est révélé et personne ne marque. Le mot suivant revient à l'équipe qui suit celle qui avait commencé ce mot.
- Une équipe qui trouve le mot après avoir reçu la main marque les points et tire les boules, comme d'habitude.
- Après une boule noire : l'équipe suivante joue le mot suivant.

### Grilles et boules

- Chaque équipe a sa grille 5×5 de numéros et sa propre urne.
- Génération d'une grille :
  - Équipe 1 : nombres impairs de 1 à 69. Équipe 2 : nombres pairs de 2 à 70. Équipes 3 et 4 : de nouveau impairs puis pairs (chaque équipe a sa propre urne, les numéros peuvent se répéter entre équipes).
  - Les 35 nombres d'une équipe sont coupés en 5 tranches croissantes de 7 nombres, une par colonne. Chaque colonne prend 5 nombres de sa tranche, triés de haut en bas.
  - 8 cases sont couvertes au départ.
  - Aucune ligne, colonne ou diagonale n'a plus de 2 cases couvertes au départ : pas de MOTUS possible dès le premier tirage de 2 boules.
- L'urne contient les boules des 17 numéros non couverts, plus 3 boules noires.
- Après avoir trouvé un mot, l'équipe tire 2 boules, une par une, avec le bouton « Tirer une boule » sur le téléphone (suspense : animation sur la TV).
  - Boule numérotée : sa case est couverte. Elle ne revient pas dans l'urne.
  - Boule noire : le tirage s'arrête tout de suite et la main passe. La boule noire est remise dans l'urne.
- Une ligne, une colonne ou une diagonale complète = MOTUS : +100 points. Le tirage s'arrête (pas de 2e boule après un MOTUS sur la 1re). Les grilles et les urnes de toutes les équipes sont alors refaites à neuf. L'équipe garde la main.
- Ni boule noire ni MOTUS : l'équipe garde la main et joue le mot suivant.

### Fin de la 1re partie

- La 1re partie dure N mots (voir « Réglages »). Le dernier mot est annoncé sur la TV (« Dernier mot ! ») et vaut 100 points au lieu de 50.
- L'équipe qui a le plus de points joue la Super partie.

### Mot décisif (égalité)

- Les équipes à égalité jouent un mot, un essai chacune à tour de rôle (dans l'ordre des équipes).
- Mot refusé ou temps écoulé : l'équipe suivante reçoit une lettre bonus. Un mauvais mot valide ne donne pas de lettre bonus.
- Après 6 lignes sans trouver, le mot est révélé et un nouveau mot décisif commence, avec l'équipe suivante.
- L'équipe qui trouve le mot va en Super partie. Aucun point n'est marqué.

### Super partie (finale)

- Jouée par l'équipe finaliste seule. Les autres téléphones voient la finale mais ne peuvent pas jouer. Les coéquipiers peuvent parler entre eux.
- 10 mots de la longueur de la partie, avec un seul chrono global (pas de minuteur par essai) : 3 min 30 pour 6 lettres, 4 min pour 7, 4 min 30 pour 8, 5 min pour 9, 5 min 30 pour 10.
- Chaque mot commence avec 3 lettres affichées : la première et deux autres à leur place.
- Même coloriage, mêmes règles de validité. Un mot refusé coûte seulement la ligne, pas la partie.
- 6 lignes par mot. Après 6 essais ratés, le mot est révélé et le suivant commence.
- Bouton « Passer » sur le téléphone : le mot est révélé, compté comme non trouvé, et le suivant commence.
- 10 mots trouvés avec du temps restant : un 11e mot bonus, facultatif. L'équipe choisit « Jouer le mot bonus » ou « Terminer » sur le téléphone. Le mot bonus se joue avec le temps restant.
- Aucun point n'est marqué en Super partie : seul le nombre de mots trouvés compte.
- Écran de fin : mots trouvés sur 10, mot bonus trouvé ou non, puis classement final. Bouton « Nouvelle partie » sur le téléphone du maître.

### Déroulé d'une partie

- Configuration (maître), 1re partie de N mots, mot décisif si égalité, Super partie, classement.
- Entre deux mots, la TV montre le mot et les scores. « Mot suivant » sur le téléphone du maître.
- « Abandonner la partie » sur le téléphone du maître, à tout moment, avec confirmation : classement direct avec les scores actuels.
- Rechargement de la TV pendant un chrono : le chrono reprend là où il en était, le temps du rechargement n'est pas compté.
- Aucun mot n'est répété dans une partie (1re partie, mot décisif et Super partie compris).

## Dictionnaire et listes de mots

- Source : Lexique 3.83 (lexique.org), base lexicale du français avec catégorie grammaticale, lemme et fréquence. Licence Creative Commons BY-SA 4.0. Crédit dans le README.
- Un script dans `tools/` produit deux jeux de données dans `src/game/words/`, enregistrés dans le dépôt (le build n'a pas besoin du réseau). Jamais modifiés à la main.
- Mots acceptés : tous les mots français de 6 à 10 lettres après normalisation, avec pluriels et féminins, infinitifs, participes présents et passés. Sans les autres formes conjuguées, noms propres, abréviations, mots avec tiret, apostrophe ou espace.
- Mots secrets : au moins 400 par longueur (6 à 10), mots courants qu'une famille connaît (seuil de fréquence), formes de base seulement (noms au singulier, adjectifs au masculin singulier, infinitifs). Pas de mots grossiers, blessants ou tristes, pas de noms propres. Chaque mot secret est aussi un mot accepté (testé).
- Stockage : une chaîne triée par longueur (mots de même longueur collés les uns aux autres), recherche par dichotomie. Pas de gros objets en mémoire.
- Seule la longueur choisie est chargée, au lancement de la partie.
- Le dictionnaire vit seulement sur la TV. Le téléphone ne vérifie pas les mots.
- Temps de chargement et mémoire mesurés sur le Fire TV Stick en phase 1.

Limite connue : Lexique ne contient pas tous les mots rares. Un mot correct mais rare peut être refusé.

## Écran TV

- Lisible de loin : grandes lettres, forts contrastes, 16:9.
- Zone principale : la grille du mot (6 lignes), cases façon jeu télé : fond bleu, carré rouge pour une lettre bien placée, rond jaune pour une lettre mal placée.
- Sur le côté : la grille de loto de chaque équipe (numéros couverts bien visibles), les scores, l'équipe active mise en avant, le chrono.
- Bandeau de message : mot inconnu, mot déjà proposé, la main passe, lettre bonus, MOTUS !, boule noire, dernier mot…
- Tirage de boule animé, puis la boule se pose sur la grille.
- Sons simples générés en Web Audio (pas de fichiers audio) : un son pour une lettre rouge, un pour une jaune, un pour une absente, tic du chrono, MOTUS, boule noire. Sons originaux : ni le générique ni le logo de l'émission.
- Super partie : chrono global en grand, compteur de mots trouvés.

## Manette (téléphone)

- Affiche : partie en cours (mot X sur N, ou Super partie), équipe active, scores, message en cours. Avec un téléphone par équipe : « Ton équipe : X ».
- Configuration (maître) : mode, équipes, longueur des mots, temps par essai, nombre de mots.
- Saisie du mot : une grande case par lettre, première lettre bloquée, clavier A–Z maison (grosses touches, utilisable d'une main), « Effacer » et « Valider ». « Valider » est grisé tant que le mot n'a pas la bonne longueur.
- Compte à rebours visible.
- Bouton « Tirer une boule » pendant le tirage.
- Super partie : bouton « Passer ».
- Boutons grisés tant que la TV anime (révélation des lettres, tirage de boule).
- Maître seulement : « Mot suivant », « Abandonner la partie » (avec confirmation), « Nouvelle partie ».
- Mode test (`&test` dans l'adresse de la manette) : forcer le mot secret, commencer directement en Super partie, forcer la prochaine boule (numéro ou noire). Jamais disponible sans `&test`.

## Protocole

- Version actuelle du protocole : 1.
- Téléphone → TV :
  - `{ v, type: "hello", clientId }` au début de chaque connexion ;
  - `{ v, type: "chooseMode", mode }`, `{ v, type: "joinTeam", name }`, `{ v, type: "removeTeam", team }` avant la partie ;
  - `{ v, type: "action", action }`. Actions (union discriminée) : `startGame` (réglages), `proposeWord`, `drawBall`, `nextWord`, `skipWord`, `playBonusWord`, `finishSuperPartie`, `abandonGame`, `newGame`, et en mode test seulement `forceSecret`, `forceBall`.
- Actions de la TV seule (jamais acceptées d'un téléphone) : fin du temps d'un essai, fin du chrono de la Super partie.
- TV → téléphone :
  - `{ v, type: "state", view, room }`. La `view` ne contient jamais le mot secret avant qu'il soit révélé sur la TV. `room` est propre à chaque téléphone : mode, maître ou non, son équipe, équipes inscrites ;
  - `{ v, type: "replaced" }` au téléphone remplacé, avec un seul téléphone.
- La TV vérifie qui envoie chaque action (maître, équipe dont c'est le tour) dans `game/permissions.ts` et ignore le reste.
- Dans les deux sens : `{ v, type: "heartbeat" }` toutes les 5 s. Sans aucun message pendant 15 s, la connexion est considérée comme perdue.
- Tous les messages sont validés avec zod à la réception.
- Version différente : message ignoré et erreur affichée (« Mets à jour la page »).

## Pages de test

- `?mode=test-tv` et `?mode=test-manette` : connexion, ping, son, diagnostic, comme dans la Roue de la Fortune.

## Hors périmètre (pour l'instant)

- Listes de mots personnalisées saisies par les joueurs
- Vrais gains, cagnotte d'une partie à l'autre
- Mode hors ligne sans serveur PeerJS
- Reprendre la place d'une équipe en pleine partie avec un autre téléphone

## Phases

0. Mise en place : outillage copié de la Roue (Vite, TypeScript strict, ESLint, Prettier, Vitest, scripts npm, workflow), `git init`.
1. Test du Fire TV Stick (prioritaire) : pages minimales TV + manette avec le `net/` copié (connexion, ping, son), et chargement du dictionnaire sur la TV avec mesure du temps et de la mémoire. L'utilisateur teste sur le vrai Fire Stick. On ne continue pas tant que ce n'est pas validé.
2. Listes de mots : script `tools/`, listes générées, tests.
3. Cœur du jeu : config, coloriage, validité, reducer, loto, scores, avec tests.
4. Protocole et réseau.
5. Vue TV.
6. Vue manette.
7. Sauvegarde et reprise (TV et téléphone).
8. Finitions : sons, animations, messages d'erreur, CI complète (check + audit avant déploiement).

Chaque phase commence par un plan court validé, et se termine par `npm run check` au vert, un résumé, la validation de l'utilisateur, puis un commit.
