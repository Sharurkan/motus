# Motus

Jeu familial inspiré de « Motus ». La TV affiche le jeu, les téléphones servent de manettes.
Usage familial privé : pas de publicité, pas de compte, pas de serveur à nous.

## Jouer

1. Sur la TV (navigateur Silk du Fire TV Stick), ouvrir :
   https://sharurkan.github.io/motus/?mode=tv
2. Appuyer sur **OK** avec la télécommande pour activer le son.
3. Sur le téléphone, scanner le QR code affiché sur la TV.
   Sinon, ouvrir https://sharurkan.github.io/motus/?mode=manette et taper le code de 4 lettres.
4. Le premier téléphone connecté choisit le mode :
   - **un seul téléphone** : on le passe à l'équipe dont c'est le tour ;
   - **un téléphone par équipe** (4 au plus) : chaque téléphone scanne le QR code et tape le nom de son équipe.
5. Le maître règle la partie (longueur des mots, temps par essai, nombre de mots), puis « Commencer ».

La TV et les téléphones doivent être sur le même Wi-Fi. Évitez le Wi-Fi « invité » : il bloque souvent la connexion directe.

## Règles en bref

- Trouver un mot de 6 à 10 lettres en 6 essais. La première lettre et une autre sont données.
- Chaque essai est colorié : **carré rouge** = lettre bien placée, **rond jaune** = lettre présente mais mal placée.
- Mot refusé (inconnu, déjà proposé, mauvaise longueur) ou temps écoulé : la main passe, l'équipe suivante reçoit une lettre bonus.
- Mot trouvé : 50 points (100 pour le dernier mot), puis 2 boules à tirer pour sa grille de loto.
  - Une ligne, une colonne ou une diagonale complète : **MOTUS**, +100 points.
  - Boule noire : la main passe.
- À la fin, l'équipe en tête joue la **Super partie** : 10 mots contre la montre (égalité : mot décisif avant).

Règles complètes : [docs/SPEC.md](docs/SPEC.md).

## En cas de souci

- **La TV ne fait pas de bruit** : appuyer sur OK avec la télécommande.
- **Le téléphone ne se connecte pas** : vérifier le Wi-Fi des deux appareils, puis recharger la page du téléphone.
- **La page a été rechargée** : la partie reprend toute seule, sur la TV comme sur le téléphone. Le temps du rechargement ne compte pas.
- **« Mets à jour la page »** : recharger la page sur la TV et sur tous les téléphones.
- **« Un autre téléphone a pris la main »** : avec un seul téléphone, le dernier connecté joue. Bouton « Reprendre la main ».

## Options de l'adresse

- `&muet` sur la TV : aucun son.
- `&test` sur la manette : mode test (mot secret forcé, prochaine boule forcée, départ direct en Super partie).

## Pages de test

Pour vérifier qu'un appareil est compatible (connexion, son, diagnostic, chargement des mots) :

- TV : `?mode=test-tv`
- Téléphone : `?mode=test-manette`

## Développement

Node.js 22.18 ou plus.

```bash
npm install
npm run dev
```

- `npm run check` : types, lint et tests (avant chaque commit)
- `npm run build` : version de production
- `npm run words` : régénère les listes de mots depuis Lexique (télécharge le fichier la première fois)
- Chaque push sur `main` est vérifié (format, types, lint, tests, audit) puis déployé sur GitHub Pages.

Règles du projet pour le code : [CLAUDE.md](CLAUDE.md).

## Listes de mots

Les listes de `src/game/words/` sont produites par `tools/build-words.ts` à partir de
**Lexique 3.83** (www.lexique.org), base de données lexicales du français, distribuée sous
licence [Creative Commons BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr).
Ces listes sont des données dérivées, partagées sous la même licence.

- Mots exclus des mots à deviner (grossiers, blessants, tristes) : `tools/secret-blocklist.txt`.
- Mots récents absents de Lexique mais acceptés (SMARTPHONE, SELFIE…) : `tools/extra-valid-words.txt`.

Référence :

- New, B., Pallier, C., Brysbaert, M., Ferrand, L. (2004). Lexique 2 : A New French Lexical
  Database. _Behavior Research Methods, Instruments, & Computers_, 36(3), 516-524.
- New, B., Pallier, C., Ferrand, L., Matos, R. (2001). Une base de données lexicales du
  français contemporain sur internet : LEXIQUE. _L'Année Psychologique_, 101, 447-462.

Jeu non officiel, sans lien avec l'émission ni avec France Télévisions. Sons et visuels originaux.
