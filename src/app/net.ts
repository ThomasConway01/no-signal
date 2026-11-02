/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Decides if the radio is actually up.
 *
 * `navigator.onLine` is the fast signal. While it says offline we make no
 * request at all, which is what the DevTools "Offline" proof depends on.
 * While it says online we confirm with one same-origin fetch the service
 * worker is forbidden to answer from cache. A cached shell must not be
 * able to fool the bunker into sulking.
 */

import { APP_BASE } from '../base';

export interface LinkWatch {
  /** Paint immediately from navigator.onLine. Do not write storage yet. */
  onOptimistic: (online: boolean) => void;
  /** The decision after the probe, or immediately when the browser says offline. */
  onConfirmed: (online: boolean) => void;
}

/** Start watching. Returns nothing; the page lives as long as the tab does. */
export function watchLink(watch: LinkWatch): void {
  const confirm = async () => {
    if (!navigator.onLine) {
      watch.onConfirmed(false);
      return;
    }
    watch.onOptimistic(true);
    watch.onConfirmed(await probe());
  };

  window.addEventListener('offline', () => watch.onConfirmed(false));
  window.addEventListener('online', () => {
    void confirm();
  });

  // DevTools' Offline checkbox flips navigator.onLine. Polling that flag
  // is local; it does not touch the network. The probe only runs when the
  // browser claims to be online.
  window.setInterval(() => {
    if (!navigator.onLine) watch.onConfirmed(false);
  }, 1000);

  void confirm();
}

/** One uncached GET. Failure means the signal is a rumour. */
export async function probe(): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);
  try {
    const url = new URL(`${APP_BASE}index.html`, window.location.origin);
    url.searchParams.set('nosignal_probe', String(Date.now()));
    const response = await fetch(url.href, {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}
