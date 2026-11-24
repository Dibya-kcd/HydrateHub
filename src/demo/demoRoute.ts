/**
 * Dedicated links for the guided demos. They use the part after "#" so they work on GitHub Pages, in the PWA and
 * in the Android/iOS shells without any server setting:
 *
 *   #/demo                the chooser (salesman demo or owner demo)
 *   #/demo/salesman       salesman tour from step 1
 *   #/demo/owner/7        owner tour, opened at step 7
 *
 * Pure functions only: no imports from the app's data layer.
 */
import type { TourId } from './tourData';

export type DemoRoute = { kind: 'chooser' } | { kind: 'tour'; tour: TourId; step: number };

const TOUR_SIZES: Record<TourId, number> = { salesman: 12, owner: 22 };

/** Returns the route for a location hash, or null when the hash is not a demo link. `step` is 0-based. */
export function parseDemoHash(hash: string): DemoRoute | null {
  const clean = (hash || '').replace(/^#\/?/, '').replace(/\/+$/, '').split('?')[0];
  const parts = clean.split('/').filter(Boolean).map((p) => p.toLowerCase());
  if (parts[0] !== 'demo') return null;
  if (parts.length === 1) return { kind: 'chooser' };
  const tour = parts[1] as TourId;
  if (tour !== 'salesman' && tour !== 'owner') return { kind: 'chooser' };
  const n = Number.parseInt(parts[2] ?? '', 10);
  const max = TOUR_SIZES[tour];
  const step = Number.isFinite(n) ? Math.min(max, Math.max(1, n)) - 1 : 0;
  return { kind: 'tour', tour, step };
}

/** Link for a tour (and optionally a 0-based step). */
export function demoHref(tour?: TourId, step = 0): string {
  if (!tour) return '#/demo';
  return step > 0 ? `#/demo/${tour}/${step + 1}` : `#/demo/${tour}`;
}

/** Leaves the demo pages and goes back to the normal app (landing / sign-in or the signed-in app). */
export function leaveDemo(): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Updates the link as the person moves between steps, without adding browser history entries. */
export function rememberStep(tour: TourId, step: number): void {
  if (typeof window === 'undefined') return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search + demoHref(tour, step));
}
