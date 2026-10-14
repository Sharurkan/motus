import { parseMode } from './shared/mode';

const NO_MODE_TEXT = 'Ajoute ?mode=tv ou ?mode=manette à l’adresse.';
const COMING_SOON_TEXT = 'Motus arrive bientôt.';

const root = document.getElementById('app');
if (root) {
  root.textContent = parseMode(window.location.search) === null ? NO_MODE_TEXT : COMING_SOON_TEXT;
}
