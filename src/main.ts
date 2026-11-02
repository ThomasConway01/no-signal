/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Boots the desk: storage, the radio check, the companion, the tube.
 */

import '@fontsource/share-tech-mono/latin-400.css';
import '@fontsource/vt323/latin-400.css';
import { registerSW } from 'virtual:pwa-register';
import { BunkerAudio } from './app/audio';
import { downloadBadge } from './app/badge';
import { openBunker, type BunkerDb } from './app/db';
import { Companion } from './app/engine';
import { watchLink } from './app/net';
import { quietParts } from './app/time';
import type { AppState, Note, Task } from './app/types';
import { mount, type View } from './app/ui';
import './style.css';

const forceScript = new URLSearchParams(window.location.search).get('persona') === 'script';

void boot();

async function boot(): Promise<void> {
  const root = document.querySelector('#app');
  if (!(root instanceof HTMLElement)) return;

  try {
    const db = await openBunker();
    const state = await loadState(db);
    const audio = new BunkerAudio();
    const companion = new Companion(forceScript);
    let beat = 0;
    let job = 0;

    const ui = mount(root, {
      onToggleSound() {
        state.soundOn = audio.toggle();
        audio.blip();
        ui.sync(state);
      },
      onSelectNote(id) {
        state.activeNoteId = id;
        audio.blip();
        ui.sync(state);
      },
      onNewNote() {
        const note: Note = { id: crypto.randomUUID(), body: '', updatedAt: Date.now() };
        state.notes.push(note);
        state.activeNoteId = note.id;
        void db.putNote(note);
        audio.blip();
        ui.sync(state);
        ui.focusNote();
      },
      onDeleteNote() {
        const id = state.activeNoteId;
        if (!id) return;
        state.notes = state.notes.filter((note) => note.id !== id);
        const next = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        state.activeNoteId = next?.id ?? null;
        void db.deleteNote(id);
        audio.blip();
        ui.sync(state);
      },
      onEditNote(body) {
        const note = state.notes.find((item) => item.id === state.activeNoteId);
        if (!note) return;
        note.body = body;
        note.updatedAt = Date.now();
        // Write through immediately. A reload in airplane mode must not lose the last line.
        void db.putNote(note);
        ui.sync(state);
      },
      onTask(task) {
        void runTask(task);
      },
      onAddRation(text) {
        const ration = { id: crypto.randomUUID(), text, done: false, createdAt: Date.now() };
        state.rations.push(ration);
        void db.putRation(ration);
        audio.blip();
        ui.sync(state);
      },
      onToggleRation(id, done) {
        const ration = state.rations.find((item) => item.id === id);
        if (!ration) return;
        ration.done = done;
        void db.putRation(ration);
        audio.blip();
        ui.sync(state);
      },
      onDeleteRation(id) {
        state.rations = state.rations.filter((item) => item.id !== id);
        void db.deleteRation(id);
        audio.blip();
        ui.sync(state);
      },
      onExportBadge() {
        void exportBadge(ui, state);
      },
      onCopyOutput() {
        void copyOutput(ui, state.output);
      },
    });

    companion.setListener((engine) => {
      state.engine = engine;
      ui.sync(state);
    });

    ui.sync(state);
    audio.setScene(state.link === 'offline' ? 'bunker' : 'signal');

    watchLink({
      onOptimistic(online) {
        state.link = online ? 'online' : 'offline';
        audio.setScene(online ? 'signal' : 'bunker');
        ui.sync(state);
      },
      onConfirmed(online) {
        const previous = state.link;
        const alreadyProbed = state.probed;
        applyLink(state, db, online, () => {
          beat = startHeartbeat(beat, state, db);
        }, () => {
          beat = stopHeartbeat(beat);
        });
        // The offline poll fires every second. Repainting then would
        // rebuild the ration list under the visitor's cursor.
        if (previous === state.link && alreadyProbed) return;
        audio.setScene(online ? 'signal' : 'bunker');
        ui.sync(state);
        ui.patchQuiet(state.lastOnlineAt);
      },
    });

    void companion.start(() => state.link === 'online' && navigator.onLine);

    if ('serviceWorker' in navigator) {
      registerSW({ immediate: true });
      navigator.serviceWorker.ready
        .then(() => {
          state.shell = 'cached';
          ui.sync(state);
        })
        .catch((error: unknown) => {
          console.warn('NO SIGNAL service worker failed', error);
        });
    }

    window.setInterval(() => {
      if (state.link === 'offline') ui.patchQuiet(state.lastOnlineAt);
    }, 1000);

    async function runTask(task: Task): Promise<void> {
      const note = state.notes.find((item) => item.id === state.activeNoteId);
      const id = ++job;
      state.busy = true;
      state.outputTask = task;
      state.output = '';
      audio.blip();
      ui.patchOutput(state);
      try {
        await companion.respond(task, note?.body ?? '', (text) => {
          if (id !== job) return;
          state.output = text;
          ui.patchOutput(state);
        });
      } finally {
        if (id === job) {
          state.busy = false;
          ui.patchOutput(state);
        }
      }
    }
  } catch (error) {
    console.error(error);
    root.textContent = 'The tube failed to warm. Reload once while you still have signal.';
  }
}

async function loadState(db: BunkerDb): Promise<AppState> {
  const [notes, rations, lastOnlineAt] = await Promise.all([
    db.getNotes(),
    db.getRations(),
    db.getKv<number>('lastOnlineAt'),
  ]);
  const newest = [...notes].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  return {
    link: navigator.onLine ? 'online' : 'offline',
    probed: false,
    notes,
    activeNoteId: newest?.id ?? null,
    rations,
    lastOnlineAt: typeof lastOnlineAt === 'number' ? lastOnlineAt : null,
    soundOn: false,
    engine: {
      mode: 'checking',
      progress: 0,
      detail: 'Checking this set for a GPU.',
    },
    output: '',
    outputTask: null,
    busy: false,
    shell: 'waiting',
  };
}

function applyLink(
  state: AppState,
  db: BunkerDb,
  online: boolean,
  startBeat: () => void,
  stopBeat: () => void,
): void {
  const next = online ? 'online' : 'offline';
  const changed = state.link !== next || !state.probed;
  state.probed = true;
  state.link = next;
  if (!changed && next === 'offline') return;
  if (online) {
    state.lastOnlineAt = Date.now();
    void db.putKv('lastOnlineAt', state.lastOnlineAt);
    startBeat();
    return;
  }
  stopBeat();
}

function startHeartbeat(existing: number, state: AppState, db: BunkerDb): number {
  window.clearInterval(existing);
  return window.setInterval(() => {
    if (state.link !== 'online') return;
    state.lastOnlineAt = Date.now();
    void db.putKv('lastOnlineAt', state.lastOnlineAt);
  }, 20_000);
}

function stopHeartbeat(existing: number): number {
  window.clearInterval(existing);
  return 0;
}

async function exportBadge(ui: View, state: AppState): Promise<void> {
  const parts = quietParts(state.lastOnlineAt, Date.now());
  await ui.repaintBadge(parts.days);
  downloadBadge(ui.badgeCanvas(), parts.days);
}

async function copyOutput(ui: View, text: string): Promise<void> {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    ui.flashCopy('Copied');
  } catch {
    ui.flashCopy('Select it');
  }
}
