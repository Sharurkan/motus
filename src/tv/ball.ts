import { createElement } from '../shared/dom';

/** Length of the CSS animation of a ball (see tv.css, .ball). */
export const BALL_ANIMATION_MS = 1800;

/** A big ball in the middle of the screen, numbered or black, for the suspense of the draw. */
export function showBall(layer: HTMLElement, value: number | null): Promise<void> {
  const ball = createElement('div', {
    className: value === null ? 'ball black' : 'ball',
    text: value === null ? '' : String(value),
  });
  layer.replaceChildren(ball);
  return new Promise((resolve) => {
    setTimeout(() => {
      ball.remove();
      resolve();
    }, BALL_ANIMATION_MS);
  });
}
