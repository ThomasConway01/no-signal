/**
 * Written by Thomas Conway.
 * Captures the README stills and a short glitch loop from the preview server.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, unlink } from 'node:fs/promises';

const base = 'http://127.0.0.1:4173/no-signal/?persona=script';
const out = new URL('../docs/', import.meta.url);

await mkdir(out, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(base, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'SIGNAL DETECTED' }).waitFor();
await page.waitForTimeout(400);

// A readable still: chromatic fringes, no sliced letters.
await page.addStyleTag({
  content: `
    .glitch::before, .glitch::after { animation: none !important; clip-path: none !important; }
    .glitch::before { transform: translate(-3px, 0); }
    .glitch::after { transform: translate(3px, 0); }
    .roll, .grain { animation: none !important; }
  `,
});
await page.screenshot({ path: file('signal.png') });

// Live glitch frames for the GIF.
await page.addStyleTag({
  content: `
    .glitch::before { animation: glitch-a 2.1s infinite linear !important; }
    .glitch::after { animation: glitch-b 1.6s infinite linear !important; }
    .roll { animation: roll 5.5s linear infinite !important; }
  `,
});
for (let i = 0; i < 12; i += 1) {
  await page.screenshot({ path: file(`frame-${String(i).padStart(2, '0')}.png`) });
  await page.waitForTimeout(140);
}

const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const bunker = await context.newPage();
await bunker.goto(base, { waitUntil: 'networkidle' });
await bunker.waitForFunction(() => navigator.serviceWorker.controller !== null);
await context.setOffline(true);
await bunker.getByRole('heading', { name: 'BUNKER OPEN' }).waitFor();
await bunker.evaluate(async () => {
  await new Promise((resolve, reject) => {
    const request = indexedDB.open('no-signal');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put(Date.now() - 4 * 86_400_000 - 3 * 3_600_000, 'lastOnlineAt');
      tx.oncomplete = () => resolve(null);
      tx.onerror = () => reject(tx.error);
    };
  });
});
await bunker.reload({ waitUntil: 'domcontentloaded' });
await bunker.getByTestId('days-value').waitFor();
await bunker.getByTestId('task-roast').click();
await bunker.getByTestId('output').getByText('Not often').waitFor();
await bunker.getByTestId('output').evaluate((node) => {
  node.scrollTop = 0;
});
const kettle = bunker.getByRole('checkbox', { name: 'Boil the kettle' });
await kettle.check();
await bunker.screenshot({ path: file('bunker.png') });

await browser.close();

const ffmpeg = spawn('ffmpeg', [
  '-y',
  '-framerate', '8',
  '-i', file('frame-%02d.png'),
  '-vf', 'fps=8,scale=960:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=64[p];[s1][p]paletteuse',
  file('signal.gif'),
], { stdio: 'inherit' });

await new Promise((resolve, reject) => {
  ffmpeg.on('exit', (code) => (code === 0 ? resolve(null) : reject(new Error(`ffmpeg ${code}`))));
});

for (let i = 0; i < 12; i += 1) {
  await unlink(file(`frame-${String(i).padStart(2, '0')}.png`)).catch(() => {});
}

function file(name) {
  return new URL(name, out).pathname;
}
