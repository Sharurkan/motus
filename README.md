# Motus

Jeu familial inspiré de « Motus ». La TV affiche le jeu, les téléphones servent de manettes.

En construction : voir [docs/SPEC.md](docs/SPEC.md).

## Développement

Node.js 22.18 ou plus.

```bash
npm install
npm run dev
```

- `npm run check` : types, lint et tests (avant chaque commit)
- `npm run build` : version de production
- `npm run words` : régénère les listes de mots depuis Lexique (télécharge le fichier la première fois)
- Chaque push sur `main` est vérifié puis déployé sur GitHub Pages.

Règles du projet pour le code : [CLAUDE.md](CLAUDE.md).

## Listes de mots

Les listes de `src/game/words/` sont produites par `tools/build-words.ts` à partir de
**Lexique 3.83** (www.lexique.org), base de données lexicales du français, distribuée sous
licence [Creative Commons BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.fr).
Ces listes sont des données dérivées, partagées sous la même licence.

Mots exclus des mots à deviner (grossiers, blessants, tristes) : `tools/secret-blocklist.txt`.

Référence :

- New, B., Pallier, C., Brysbaert, M., Ferrand, L. (2004). Lexique 2 : A New French Lexical
  Database. _Behavior Research Methods, Instruments, & Computers_, 36(3), 516-524.
- New, B., Pallier, C., Ferrand, L., Matos, R. (2001). Une base de données lexicales du
  français contemporain sur internet : LEXIQUE. _L'Année Psychologique_, 101, 447-462.
