/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Proves the sulk screen, the offline bunker, and a quiet network panel.
 */

import { expect, test } from '@playwright/test';
import { quietParts } from '../src/app/time';
import { scriptedRespond } from '../src/app/persona';
import { DEMO_NOTE_BODY } from '../src/app/seed';

const BASE = process.env.VITE_BASE || '/';
const APP = `${BASE}?persona=script`;

test('sulks while the radio is up', async ({ page }) => {
  await page.goto(APP);
  await expect(page.locator('[data-testid="screen"]')).toHaveAttribute('data-probed', 'yes');
  await expect(page.locator('[data-testid="screen"]')).toHaveAttribute('data-link', 'online');
  await expect(page.getByRole('heading', { name: 'SIGNAL DETECTED' })).toBeVisible();
  await expect(page.getByText('DISCONNECT IMMEDIATELY', { exact: true })).toBeVisible();
  await expect(page.getByTestId('stock-detail')).toContainText(/scripted persona/i);
  await expect(page.locator('#bunker-view')).toBeHidden();

  const manifest = await page.request.get(`${BASE}manifest.webmanifest`);
  expect(manifest.ok()).toBeTruthy();
  const body = await manifest.json();
  expect(body.name).toBe('NO SIGNAL');
  expect(body.start_url).toContain(BASE);

  const worker = await page.request.get(`${BASE}sw.js`);
  expect(worker.ok()).toBeTruthy();
  const source = await worker.text();
  expect(source).toContain('webllm/model');
  expect(source).toContain(`"${BASE}"`);
  expect(source).toContain('index.html');
});

test('works offline, remembers rations, and makes no network calls', async ({ page, context }) => {
  const failed: string[] = [];
  const foreign: string[] = [];
  let tracking = false;

  page.on('requestfailed', (request) => {
    if (!tracking) return;
    if (request.url().startsWith('http://127.0.0.1:4173')) failed.push(request.url());
  });
  page.on('request', (request) => {
    if (!tracking) return;
    const url = new URL(request.url());
    if (url.host !== '127.0.0.1:4173') foreign.push(request.url());
  });

  await page.goto(APP);
  await expect(page.locator('[data-testid="screen"]')).toHaveAttribute('data-probed', 'yes');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  await context.setOffline(true);
  await expect(page.getByRole('heading', { name: 'BUNKER OPEN' })).toBeVisible();
  await expect(page.getByTestId('note')).toHaveValue(/14 tabs/);

  tracking = true;
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'BUNKER OPEN' })).toBeVisible();
  await expect(page.getByTestId('shell-state')).toHaveText('SHELL CACHED');
  await expect(page.getByTestId('note')).toHaveValue(/14 tabs/);
  await expect(page.getByText('Boil the kettle')).toBeVisible();

  await page.getByTestId('task-summarise').click();
  await expect(page.getByTestId('output')).toContainText('tomorrow', { timeout: 10_000 });
  await expect(page.getByTestId('output')).toContainText('Field note');

  await page.getByTestId('task-roast').click();
  await expect(page.getByTestId('output')).toContainText(/tabs/i, { timeout: 10_000 });

  await page.getByTestId('ration-input').fill('Hide the router');
  await page.getByTestId('ration-form').locator('button[type="submit"]').click();
  await expect(page.getByText('Hide the router')).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-badge').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^no-signal-days-/);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByText('Hide the router')).toBeVisible();

  await page.getByRole('button', { name: 'New note' }).click();
  await page.getByTestId('note').fill('A short field note about bread.');
  await page.getByTestId('task-rewrite').click();
  await expect(page.getByTestId('output')).toContainText('bread', { timeout: 10_000 });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('note')).toHaveValue(/bread/);

  expect(failed, `failed requests:\n${failed.join('\n')}`).toEqual([]);
  expect(foreign, `foreign requests:\n${foreign.join('\n')}`).toEqual([]);
});

test('counts days since the last confirmed signal', async ({ page, context }) => {
  await page.goto(APP);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  await context.setOffline(true);
  await expect(page.getByRole('heading', { name: 'BUNKER OPEN' })).toBeVisible();

  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('no-signal');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('kv', 'readwrite');
        tx.objectStore('kv').put(Date.now() - 4 * 86_400_000, 'lastOnlineAt');
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('days-value')).toHaveText('04');
});

test('boots without forcing the scripted persona', async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator('[data-testid="screen"]')).toHaveAttribute('data-probed', 'yes');
  await expect(page.locator('[data-testid="screen"]')).toHaveAttribute('data-link', 'online');
  await expect(page.getByRole('heading', { name: 'SIGNAL DETECTED' })).toBeVisible();
  await expect(page.locator('#bunker-view')).toBeHidden();
  // Headless Chromium has no adapter, so this lands on the persona.
  // A machine with WebGPU instead reports the haul. Either way the tube stays up.
  await expect(page.getByTestId('stock-detail')).toContainText(/scripted persona|Hauling Qwen|Waking the model/i);
});

test('scripted persona stays specific to the note', () => {
  const summary = scriptedRespond('summarise', DEMO_NOTE_BODY);
  const roast = scriptedRespond('roast', DEMO_NOTE_BODY);
  const rewrite = scriptedRespond('rewrite', DEMO_NOTE_BODY);
  expect(summary).toContain('14 tabs');
  expect(summary).toContain('tomorrow');
  expect(roast).toContain('notebook app');
  expect(rewrite).toContain('I will go offline now.');
  expect(rewrite).not.toContain('!!!');
  expect(scriptedRespond('roast', '   ')).toContain('nothing on the page');
  expect(quietParts(1_000, 1_000 + 4 * 86_400_000 + 3_600_000)).toEqual({
    days: 4,
    hms: '01:00:00',
  });
  expect(quietParts(null, 1_000).days).toBeNull();
});
