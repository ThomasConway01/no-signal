/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Precaches the app shell and serves model files cache-first.
 *
 * Model weights are not in the git repo (the largest shard is ~65MB and the
 * set is ~265MB). On the first stocking run the page fetches them from
 * Hugging Face. This worker stores those responses in the same Cache API
 * buckets WebLLM reads (`webllm/model`, `webllm/wasm`, `webllm/config`),
 * then serves them without touching the network. One copy, not two.
 */

import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { NetworkOnly } from 'workbox-strategies';
import { APP_BASE } from './base';

declare let self: ServiceWorkerGlobalScope;

// Take the page over on the first visit so a reload can already be offline.
clientsClaim();
self.skipWaiting();
cleanupOutdatedCaches();

// App shell: HTML, JS, CSS, fonts, icons. Injected at build time.
precacheAndRoute(self.__WB_MANIFEST);

// SPA navigations resolve to the cached shell. The connectivity probe is
// excluded so a cached page can never pretend the radio is up.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${APP_BASE}index.html`), {
    denylist: [/nosignal_probe/],
  }),
);

// Same-origin probe. Network only, never cached, never used while offline.
registerRoute(({ url }) => url.searchParams.has('nosignal_probe'), new NetworkOnly());

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!isModelHost(url.hostname)) return;
  event.respondWith(modelCacheFirst(event.request));
});

/** Hosts WebLLM fetches for weights, tokenizer, config, and the wasm lib. */
function isModelHost(hostname: string): boolean {
  return (
    hostname === 'huggingface.co' ||
    hostname.endsWith('.huggingface.co') ||
    hostname.endsWith('.githubusercontent.com')
  );
}

/** Which WebLLM cache bucket a URL belongs in. */
function scopeFor(url: URL): string {
  const path = url.pathname.toLowerCase();
  if (path.endsWith('.wasm')) return 'webllm/wasm';
  if (path.endsWith('mlc-chat-config.json') || path.endsWith('mlc-model-manifest.json')) {
    return 'webllm/config';
  }
  return 'webllm/model';
}

/**
 * Cache-first for model artifacts. Range requests are answered from the
 * full cached body when we have one, and are never stored as partials.
 */
async function modelCacheFirst(request: Request): Promise<Response> {
  const cache = await caches.open(scopeFor(new URL(request.url)));
  const key = new Request(request.url);
  const range = request.headers.get('range');

  if (range) {
    const full = await cache.match(key, { ignoreVary: true });
    if (full) return sliceRange(full, range);
    return fetch(request);
  }

  const hit = await cache.match(key, { ignoreVary: true });
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok && response.status === 200 && (response.type === 'basic' || response.type === 'cors')) {
    try {
      await cache.put(key, response.clone());
    } catch (error) {
      console.warn('NO SIGNAL could not retain a model file', error);
    }
  }
  return response;
}

/** Build a 206 from a cached full body so a range fetch still works offline. */
async function sliceRange(full: Response, rangeHeader: string): Promise<Response> {
  const buffer = await full.arrayBuffer();
  const match = /bytes=(\d+)-(\d+)?/.exec(rangeHeader);
  if (!match) {
    return new Response(buffer, {
      status: 200,
      headers: corsHeaders(full.headers.get('Content-Type')),
    });
  }
  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : buffer.byteLength - 1;
  const slice = buffer.slice(start, Math.min(end, buffer.byteLength - 1) + 1);
  const headers = corsHeaders(full.headers.get('Content-Type'));
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Content-Range', `bytes ${start}-${end}/${buffer.byteLength}`);
  headers.set('Content-Length', String(slice.byteLength));
  return new Response(slice, { status: 206, statusText: 'Partial Content', headers });
}

function corsHeaders(contentType: string | null): Headers {
  const headers = new Headers();
  if (contentType) headers.set('Content-Type', contentType);
  headers.set('Access-Control-Allow-Origin', '*');
  return headers;
}
