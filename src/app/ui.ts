/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Builds the CRT and patches it. User text goes in via textContent or
 * textarea.value, never via innerHTML.
 */

import { paintBadge } from './badge';
import { DEMO_NOTE_ID } from './seed';
import { quietParts } from './time';
import type { AppState, Ration, Task } from './types';

const SULK_LINES = [
  'I can smell the wi-fi.',
  'Put the cable down.',
  'The bunker door stays shut while they can see in.',
  'Every packet is a fluorescent light.',
  'I do not work in front of an audience.',
  'Airplane mode is a love language.',
];

export interface Actions {
  onToggleSound: () => void;
  onSelectNote: (id: string) => void;
  onNewNote: () => void;
  onDeleteNote: () => void;
  onEditNote: (body: string) => void;
  onTask: (task: Task) => void;
  onAddRation: (text: string) => void;
  onToggleRation: (id: string, done: boolean) => void;
  onDeleteRation: (id: string) => void;
  onExportBadge: () => void;
  onCopyOutput: () => void;
}

export interface View {
  sync: (state: AppState) => void;
  patchOutput: (state: AppState) => void;
  patchQuiet: (lastOnlineAt: number | null) => void;
  repaintBadge: (days: number | null) => Promise<void>;
  badgeCanvas: () => HTMLCanvasElement;
  focusNote: () => void;
  flashCopy: (label: string) => void;
}

/** Mount the monitor once. Later calls only patch. */
export function mount(root: HTMLElement, actions: Actions): View {
  root.replaceChildren();

  const desk = el('div', 'desk');
  const monitor = el('div', 'monitor');
  const bezel = el('div', 'bezel');
  const led = el('span', 'led');
  led.dataset.state = 'online';
  led.setAttribute('aria-hidden', 'true');
  const bezelName = el('span', 'bezel-name');
  bezelName.textContent = 'NO SIGNAL';
  const bezelSub = el('span', 'bezel-sub');
  bezelSub.textContent = 'OFFLINE COMPANION';
  const sound = document.createElement('button');
  sound.type = 'button';
  sound.id = 'sound';
  sound.className = 'sound';
  sound.textContent = 'Sound off';
  sound.setAttribute('aria-pressed', 'false');
  bezel.append(el('span', 'screw'), led, bezelName, bezelSub, sound, el('span', 'screw'));

  const screen = el('div', 'screen');
  screen.dataset.mode = 'online';
  screen.dataset.link = 'online';
  screen.dataset.probed = 'no';
  screen.dataset.testid = 'screen';
  const fx = el('div', 'fx');
  fx.setAttribute('aria-hidden', 'true');
  fx.append(el('div', 'roll'), el('div', 'grain'));

  const body = el('div', 'screen-body');
  const live = el('p', 'sr-only');
  live.setAttribute('aria-live', 'polite');

  const signal = buildSignal();
  const bunker = buildBunker(actions);
  body.append(live, signal.view, bunker.view);
  screen.append(fx, body);

  const chin = el('div', 'chin');
  chin.append(el('span', 'screw'), grille(), el('span', 'screw'));
  monitor.append(bezel, screen, chin);
  desk.append(monitor);
  root.append(desk);

  sound.addEventListener('click', () => actions.onToggleSound());

  // The sulk line rotates on its own. It is decoration, not state.
  let sulkIndex = 0;
  signal.sulk.textContent = SULK_LINES[0];
  window.setInterval(() => {
    sulkIndex = (sulkIndex + 1) % SULK_LINES.length;
    signal.sulk.textContent = SULK_LINES[sulkIndex];
  }, 2800);

  let paintedNoteId: string | null = null;
  let paintedDays: string | null = null;
  let copyReset = 0;

  const view: View = {
    sync(state) {
      const online = state.link === 'online';
      screen.dataset.mode = online ? 'online' : 'offline';
      screen.dataset.link = state.link;
      screen.dataset.probed = state.probed ? 'yes' : 'no';
      led.dataset.state = online ? 'online' : 'offline';
      signal.view.hidden = !online;
      bunker.view.hidden = online;
      live.textContent = online ? 'Signal detected. Disconnect immediately.' : 'Bunker open. The network is gone.';

      sound.textContent = state.soundOn ? 'Sound on' : 'Sound off';
      sound.setAttribute('aria-pressed', state.soundOn ? 'true' : 'false');

      paintStock(signal, state);
      paintNotes(bunker, state);
      paintRations(bunker, state);
      paintOutput(bunker, state);
      paintEngineFoot(bunker, state);

      const active = state.notes.find((note) => note.id === state.activeNoteId) ?? null;
      if (bunker.note !== document.activeElement || active?.id !== paintedNoteId) {
        bunker.note.value = active?.body ?? '';
        paintedNoteId = active?.id ?? null;
      }
      bunker.note.disabled = !active;
      bunker.deleteNote.disabled = !active;
      bunker.demoFlag.hidden = active?.id !== DEMO_NOTE_ID;
      view.patchQuiet(state.lastOnlineAt);
    },
    patchOutput(state) {
      paintOutput(bunker, state);
    },
    patchQuiet(lastOnlineAt) {
      const parts = quietParts(lastOnlineAt, Date.now());
      bunker.days.textContent = parts.days == null ? '—' : String(parts.days).padStart(2, '0');
      bunker.clock.textContent = parts.hms;
      const key = parts.days == null ? 'none' : String(parts.days);
      if (key !== paintedDays) {
        paintedDays = key;
        void paintWhenReady(bunker.canvas, parts.days);
      }
    },
    async repaintBadge(days) {
      await paintWhenReady(bunker.canvas, days);
    },
    badgeCanvas: () => bunker.canvas,
    focusNote() {
      bunker.note.focus();
    },
    flashCopy(label) {
      bunker.copy.textContent = label;
      window.clearTimeout(copyReset);
      copyReset = window.setTimeout(() => {
        bunker.copy.textContent = 'Copy';
      }, 1200);
    },
  };

  return view;
}

interface SignalParts {
  view: HTMLElement;
  sulk: HTMLElement;
  stockLabel: HTMLElement;
  stockDetail: HTMLElement;
  barTrack: HTMLElement;
  barFill: HTMLElement;
}

function buildSignal(): SignalParts {
  const view = el('section', 'signal');
  view.id = 'signal-view';

  const eyebrow = el('p', 'eyebrow');
  eyebrow.textContent = 'carrier lock  ·  bunker sealed';

  const title = document.createElement('h1');
  title.className = 'glitch';
  title.dataset.text = 'SIGNAL DETECTED';
  title.textContent = 'SIGNAL DETECTED';
  // The glitch layers repeat the words in CSS. The label keeps the name once.
  title.setAttribute('aria-label', 'SIGNAL DETECTED');

  const disconnect = el('p', 'disconnect');
  disconnect.textContent = 'DISCONNECT IMMEDIATELY';

  const sulk = el('p', 'sulk');

  const stock = el('div', 'stock');
  const stockLabel = el('p', 'stock-label');
  stockLabel.textContent = 'CHECKING THE SET';
  const barTrack = el('div', 'bar-track');
  barTrack.setAttribute('role', 'progressbar');
  barTrack.setAttribute('aria-valuemin', '0');
  barTrack.setAttribute('aria-valuemax', '100');
  const barFill = el('div', 'bar-fill');
  barTrack.append(barFill);
  const stockDetail = el('p', 'stock-detail');
  stockDetail.dataset.testid = 'stock-detail';
  stockDetail.textContent = 'Checking this set for a GPU.';
  stock.append(stockLabel, barTrack, stockDetail);

  const hint = el('p', 'hint');
  hint.textContent = 'Flip airplane mode, or in DevTools set Network to Offline. I will know the difference.';

  view.append(eyebrow, title, disconnect, sulk, stock, hint);
  return { view, sulk, stockLabel, stockDetail, barTrack, barFill };
}

interface BunkerParts {
  view: HTMLElement;
  chipRow: HTMLElement;
  note: HTMLTextAreaElement;
  demoFlag: HTMLElement;
  deleteNote: HTMLButtonElement;
  output: HTMLElement;
  caret: HTMLElement;
  taskLabel: HTMLElement;
  copy: HTMLButtonElement;
  tasks: HTMLButtonElement[];
  rationList: HTMLElement;
  rationInput: HTMLInputElement;
  days: HTMLElement;
  clock: HTMLElement;
  canvas: HTMLCanvasElement;
  shell: HTMLElement;
  engine: HTMLElement;
}

function buildBunker(actions: Actions): BunkerParts {
  const view = el('section', 'bunker');
  view.id = 'bunker-view';
  view.hidden = true;

  const top = el('header', 'top');
  const titles = el('div', 'titles');
  const eyebrow = el('p', 'eyebrow');
  eyebrow.textContent = 'link lost  ·  the quiet is holding';
  const heading = document.createElement('h2');
  heading.textContent = 'BUNKER OPEN';
  const sub = el('p', 'sub');
  sub.textContent = 'The network is gone. I can work.';
  titles.append(eyebrow, heading, sub);

  const readout = el('div', 'quiet-readout');
  const days = el('span', 'days');
  days.dataset.testid = 'days-value';
  days.textContent = '—';
  const caption = el('span', 'quiet-caption');
  caption.textContent = 'days since last online';
  const clock = el('span', 'clock');
  clock.dataset.testid = 'quiet-clock';
  clock.textContent = '--:--:--';
  readout.append(days, caption, clock);
  top.append(titles, readout);

  const workspace = el('div', 'workspace');
  const notes = el('section', 'panel notes');
  const notesHead = el('div', 'panel-head');
  const notesTitle = document.createElement('h3');
  notesTitle.textContent = 'NOTES';
  const noteActions = el('div', 'note-actions');
  const newNote = button('New note', 'ghost');
  const deleteNote = button('Delete note', 'ghost');
  noteActions.append(newNote, deleteNote);
  notesHead.append(notesTitle, noteActions);
  const chipRow = el('div', 'chips');
  const demoFlag = el('p', 'demo-flag');
  demoFlag.textContent = 'Preloaded, so you can try this in one breath.';
  const note = document.createElement('textarea');
  note.dataset.testid = 'note';
  note.spellcheck = true;
  note.maxLength = 8000;
  note.placeholder = 'Write it here. The network does not get a copy.';
  const tasks = el('div', 'tasks');
  const summarise = button('Summarise', 'primary');
  summarise.dataset.testid = 'task-summarise';
  const roast = button('Roast', 'ghost');
  roast.dataset.testid = 'task-roast';
  const rewrite = button('Rewrite', 'ghost');
  rewrite.dataset.testid = 'task-rewrite';
  tasks.append(summarise, roast, rewrite);
  notes.append(notesHead, chipRow, demoFlag, note, tasks);

  const receiver = el('section', 'panel receiver');
  const receiverHead = el('div', 'panel-head');
  const receiverTitle = document.createElement('h3');
  const taskLabel = el('span', 'task-label');
  taskLabel.textContent = 'RECEIVER';
  receiverTitle.append(taskLabel);
  const copy = button('Copy', 'ghost');
  copy.dataset.testid = 'copy-output';
  receiverHead.append(receiverTitle, copy);
  const output = el('pre', 'output');
  output.dataset.testid = 'output';
  const caret = el('span', 'caret');
  caret.hidden = true;
  caret.setAttribute('aria-hidden', 'true');
  receiver.append(receiverHead, output, caret);

  workspace.append(notes, receiver);

  const lower = el('div', 'lower');
  const rations = el('section', 'panel rations');
  const rationsTitle = document.createElement('h3');
  rationsTitle.textContent = 'SURVIVAL RATIONS';
  const rationList = document.createElement('ul');
  const form = document.createElement('form');
  form.className = 'ration-form';
  form.dataset.testid = 'ration-form';
  const rationLabel = el('label', 'sr-only');
  rationLabel.setAttribute('for', 'ration-input');
  rationLabel.textContent = 'New ration';
  const rationInput = document.createElement('input');
  rationInput.id = 'ration-input';
  rationInput.dataset.testid = 'ration-input';
  rationInput.maxLength = 140;
  rationInput.placeholder = 'Stow a ration';
  rationInput.autocomplete = 'off';
  const stow = button('Stow', 'primary');
  stow.type = 'submit';
  form.append(rationLabel, rationInput, stow);
  rations.append(rationsTitle, rationList, form);

  const plate = el('section', 'panel badge-plate');
  const plateHead = el('div', 'panel-head');
  const plateTitle = document.createElement('h3');
  plateTitle.textContent = 'DAYS SINCE LAST ONLINE';
  const exportButton = button('Export PNG', 'primary');
  exportButton.dataset.testid = 'export-badge';
  plateHead.append(plateTitle, exportButton);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', 'Days since last online badge');
  plate.append(plateHead, canvas);
  lower.append(rations, plate);

  const foot = el('footer', 'foot');
  const promise = el('span', 'promise');
  promise.textContent = 'Nothing leaves this device. Thomas Conway · Hackyard Yard #6';
  const shell = el('span', 'shell');
  shell.dataset.testid = 'shell-state';
  shell.textContent = 'SHELL WAITING';
  const engine = el('span', 'engine');
  engine.dataset.testid = 'engine-state';
  engine.textContent = 'ENGINE CHECKING';
  foot.append(promise, shell, engine);

  view.append(top, workspace, lower, foot);

  newNote.addEventListener('click', () => actions.onNewNote());
  deleteNote.addEventListener('click', () => actions.onDeleteNote());
  note.addEventListener('input', () => actions.onEditNote(note.value));
  summarise.addEventListener('click', () => actions.onTask('summarise'));
  roast.addEventListener('click', () => actions.onTask('roast'));
  rewrite.addEventListener('click', () => actions.onTask('rewrite'));
  copy.addEventListener('click', () => actions.onCopyOutput());
  exportButton.addEventListener('click', () => actions.onExportBadge());

  chipRow.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.note;
    if (id) actions.onSelectNote(id);
  });

  rationList.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const id = target.dataset.id;
    if (id) actions.onToggleRation(id, target.checked);
  });

  rationList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    const id = target.dataset.drop;
    if (id) actions.onDeleteRation(id);
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const text = rationInput.value.trim();
    if (!text) return;
    rationInput.value = '';
    actions.onAddRation(text);
  });

  return {
    view,
    chipRow,
    note,
    demoFlag,
    deleteNote,
    output,
    caret,
    taskLabel,
    copy,
    tasks: [summarise, roast, rewrite],
    rationList,
    rationInput,
    days,
    clock,
    canvas,
    shell,
    engine,
  };
}

function paintStock(signal: SignalParts, state: AppState): void {
  const { mode, progress, detail } = state.engine;
  const labels: Record<AppState['engine']['mode'], string> = {
    checking: 'CHECKING THE SET',
    stocking: 'STOCKING THE BUNKER',
    ready: 'BUNKER STOCKED',
    scripted: 'SCRIPTED WATCH',
  };
  signal.stockLabel.textContent = labels[mode];
  signal.stockDetail.textContent = detail;
  const showBar = mode === 'stocking' || mode === 'ready';
  signal.barTrack.hidden = !showBar;
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
  signal.barFill.style.width = `${pct}%`;
  signal.barTrack.setAttribute('aria-valuenow', String(pct));
}

function paintNotes(bunker: BunkerParts, state: AppState): void {
  const sorted = [...state.notes].sort((a, b) => b.updatedAt - a.updatedAt);
  bunker.chipRow.replaceChildren();
  for (const note of sorted) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = note.id === state.activeNoteId ? 'chip on' : 'chip';
    chip.dataset.note = note.id;
    chip.textContent = note.id === DEMO_NOTE_ID ? 'Demo note' : snippet(note.body);
    bunker.chipRow.append(chip);
  }
}

function paintRations(bunker: BunkerParts, state: AppState): void {
  // Leave the input alone if the visitor is mid-word.
  bunker.rationList.replaceChildren();
  if (!state.rations.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'No rations stowed.';
    bunker.rationList.append(empty);
    return;
  }
  const ordered = [...state.rations].sort((a, b) => a.createdAt - b.createdAt);
  for (const ration of ordered) bunker.rationList.append(rationRow(ration));
}

function rationRow(ration: Ration): HTMLLIElement {
  const item = document.createElement('li');
  if (ration.done) item.className = 'done';
  const label = document.createElement('label');
  const box = document.createElement('input');
  box.type = 'checkbox';
  box.checked = ration.done;
  box.dataset.id = ration.id;
  const text = document.createElement('span');
  text.textContent = ration.text;
  label.append(box, text);
  const drop = document.createElement('button');
  drop.type = 'button';
  drop.className = 'texty';
  drop.dataset.drop = ration.id;
  drop.textContent = 'Drop';
  drop.setAttribute('aria-label', `Drop ration: ${ration.text}`);
  item.append(label, drop);
  return item;
}

function paintOutput(bunker: BunkerParts, state: AppState): void {
  const names: Record<Task, string> = {
    summarise: 'SUMMARY',
    roast: 'ROAST',
    rewrite: 'REWRITE',
  };
  bunker.taskLabel.textContent = state.outputTask ? names[state.outputTask] : 'RECEIVER';
  bunker.output.textContent = state.output || (state.busy ? '' : 'The receiver is quiet. Hand me a note.');
  bunker.output.dataset.busy = state.busy ? 'true' : 'false';
  bunker.caret.hidden = !state.busy;
  const blocked = state.busy || !state.activeNoteId;
  for (const task of bunker.tasks) task.disabled = blocked;
  bunker.copy.disabled = !state.output;
  if (state.busy) bunker.output.scrollTop = bunker.output.scrollHeight;
}

function paintEngineFoot(bunker: BunkerParts, state: AppState): void {
  bunker.shell.textContent = state.shell === 'cached' ? 'SHELL CACHED' : 'SHELL WAITING';
  const engineLabels: Record<AppState['engine']['mode'], string> = {
    checking: 'ENGINE CHECKING',
    stocking: 'ENGINE STOCKING',
    ready: 'ENGINE LOCAL MODEL',
    scripted: 'ENGINE SCRIPTED',
  };
  bunker.engine.textContent = engineLabels[state.engine.mode];
}

async function paintWhenReady(canvas: HTMLCanvasElement, days: number | null): Promise<void> {
  try {
    await document.fonts.load('54px VT323');
    await document.fonts.load('32px "Share Tech Mono"');
  } catch {
    // The plate still draws in the fallback monospace.
  }
  paintBadge(canvas, days, new Date());
}

function snippet(body: string): string {
  const clean = body.replace(/\s+/g, ' ').trim();
  if (!clean) return 'Blank note';
  return clean.length > 22 ? `${clean.slice(0, 22)}…` : clean;
}

function button(label: string, kind: 'primary' | 'ghost'): HTMLButtonElement {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = kind;
  node.textContent = label;
  return node;
}

function grille(): HTMLElement {
  const node = el('span', 'grille');
  node.setAttribute('aria-hidden', 'true');
  return node;
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
