/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * The public path shared by the app, the service worker, and the manifest.
 */

/**
 * Deployment base, taken from Vite's `base` option (`import.meta.env.BASE_URL`).
 * It is '/' by default. Set `VITE_BASE=/no-signal/` at build time to serve from a
 * sub-path such as a GitHub project site. Always ends with a slash.
 */
const raw: string = import.meta.env.BASE_URL || '/';
export const APP_BASE = raw.endsWith('/') ? raw : `${raw}/`;
