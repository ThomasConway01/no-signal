/**
 * Written by Thomas Conway.
 * Records the demo video against the live site: online sulk, network cut, bunker at work, offline reload.
 * Captions are a page overlay drawn by this script; the app itself is unmodified.
 */
import { chromium } from '@playwright/test';

const SITE = process.env.SITE || 'https://no-signal.thethomas.tech/';
const URL_ = `${SITE}?persona=script`;
const size = { width: 1440, height: 900 };

// Headless Chromium, laptop frame. Raw takes land in demo/raw (gitignored).
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: size, recordVideo: { dir: 'demo/raw', size } });
// Caption bar and an INTERNET: ON/OFF pill. Pointer events stay off so clicks hit the app.
await context.addInitScript(() => {
  const draw = () => {
    if (!document.body) return requestAnimationFrame(draw);
    let hud = document.getElementById('demo-hud');
    if (!hud) {
      hud = document.createElement('div');
      hud.id = 'demo-hud';
      hud.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:2147483647;pointer-events:none;font:600 22px/1.35 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.82);padding:12px 20px;display:flex;justify-content:space-between;gap:20px;align-items:center';
      document.body.appendChild(hud);
    }
    const net = navigator.onLine;
    hud.innerHTML = `<span>${localStorage.getItem('demo_caption') || ''}</span><span style="white-space:nowrap;padding:4px 12px;border-radius:6px;background:${net ? '#b3261e' : '#1e7d32'}">${net ? 'INTERNET: ON' : 'INTERNET: OFF'}</span>`;
    setTimeout(draw, 250);
  };
  draw();
});
const page = await context.newPage();
const cap = (t) => page.evaluate((t) => localStorage.setItem('demo_caption', t), t);
const wait = (ms) => page.waitForTimeout(ms);

// Online sulk, long enough for the service worker to take the shell.
await page.goto(URL_, { waitUntil: 'networkidle' });
await cap('NO SIGNAL — an AI notes desk that refuses to work online.');
await page.getByRole('heading', { name: 'SIGNAL DETECTED' }).waitFor();
await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
await wait(3500);
await cap('Connected, it sulks. First visit caches the whole app on this machine.');
await wait(3500);

// Cut the network, then show a real fetch to example.com failing on screen.
await cap('Cutting the internet now (browser network set to Offline).');
await wait(1500);
await context.setOffline(true);
await page.getByRole('heading', { name: 'BUNKER OPEN' }).waitFor();
await wait(2500);
const probe = await page.evaluate(async () => {
  try { await fetch('https://example.com/', { cache: 'no-store' }); return 'reached example.com'; }
  catch (e) { return 'fetch to example.com FAILED: ' + e.message; }
});
await cap(`No route out — ${probe}. The bunker opens.`);
await wait(4000);

// The three desk jobs, still offline. The scripted persona answers (no GPU here).
await cap('A demo note is already on the desk. Summarise it, offline.');
await page.getByTestId('task-summarise').click();
await page.getByTestId('output').filter({ hasText: 'tomorrow' }).waitFor({ timeout: 15000 });
await wait(4500);
await cap('Roast it.');
await page.getByTestId('task-roast').click();
await wait(4500);
await cap('Rewrite it into something calmer.');
await page.getByTestId('task-rewrite').click();
await wait(4500);

// A ration written into IndexedDB, then a hard reload that must come from cache.
await cap('Stow a survival ration (offline to-do), saved to this device.');
await page.getByTestId('ration-input').click();
await page.getByTestId('ration-input').pressSequentially('Hide the router', { delay: 70 });
await page.getByTestId('ration-form').locator('button[type="submit"]').click();
await wait(3000);

await cap('Still offline: hard reload. The app shell comes from the local cache.');
await wait(1500);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'BUNKER OPEN' }).waitFor();
await page.getByText('Hide the router').waitFor();
await wait(4000);
// Local PNG of the days badge. Nothing leaves the machine.
await cap('Note and rations survived. Export the days-offline badge as a PNG.');
const dl = page.waitForEvent('download');
await page.getByTestId('export-badge').click();
await dl;
await wait(3500);

await cap('Recorder has no GPU, so the scripted persona answers here; with WebGPU, Qwen2.5 0.5B runs on-device.');
await wait(5000);
await cap('NO SIGNAL · no-signal.thethomas.tech · github.com/ThomasConway01/no-signal');
await wait(4000);

// Close the context so Playwright finishes the file, then print its path.
const video = page.video();
await context.close();
console.log(await video.path());
await browser.close();
