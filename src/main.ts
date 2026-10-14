import './style.css';
import { startTestPhone } from './diagnostic/test-phone';
import { startTestTv } from './diagnostic/test-tv';
import { parseMode } from './shared/mode';
import { startTv } from './tv/tv-app';

const NO_MODE_TEXT = 'Ajoute ?mode=tv ou ?mode=manette à l’adresse.';
const COMING_SOON_TEXT = 'La manette arrive bientôt. Pour tester : ?mode=test-manette.';

const root = document.getElementById('app');
if (root) {
  switch (parseMode(window.location.search)) {
    case 'tv':
      startTv(root);
      break;
    case 'manette':
      root.textContent = COMING_SOON_TEXT;
      break;
    case 'test-tv':
      startTestTv(root);
      break;
    case 'test-manette':
      startTestPhone(root);
      break;
    case null:
      root.textContent = NO_MODE_TEXT;
  }
}
