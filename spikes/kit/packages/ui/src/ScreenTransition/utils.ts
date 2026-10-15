import { REDUCED_MOTION_QUERY } from './consts';

export function supportsViewTransitions(): boolean {
  return typeof document !== 'undefined' && typeof document.startViewTransition === 'function';
}

export function startScreenTransition(update: () => void): void {
  const reduced = typeof window !== 'undefined' && window.matchMedia(REDUCED_MOTION_QUERY).matches;

  if (reduced || !supportsViewTransitions()) {
    update();
    return;
  }

  document.startViewTransition(update);
}
