/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * IndexedDB for notes, rations, and the last time the signal was real.
 * If storage is blocked, a memory desk keeps the session from dying.
 */

import { DEMO_NOTE_BODY, DEMO_NOTE_ID, DEMO_RATIONS } from './seed';
import type { Note, Ration } from './types';

const DB_NAME = 'no-signal';
const DB_VERSION = 1;

export interface BunkerDb {
  getNotes(): Promise<Note[]>;
  putNote(note: Note): Promise<void>;
  deleteNote(id: string): Promise<void>;
  getRations(): Promise<Ration[]>;
  putRation(ration: Ration): Promise<void>;
  deleteRation(id: string): Promise<void>;
  getKv<T>(key: string): Promise<T | undefined>;
  putKv(key: string, value: unknown): Promise<void>;
}

/** Open the desk, seed it once, and fall back to memory if IndexedDB refuses. */
export async function openBunker(): Promise<BunkerDb> {
  try {
    const db = await openIndexedDb();
    await seedIfNeeded(db);
    return db;
  } catch (error) {
    console.warn('NO SIGNAL IndexedDB unavailable, using a memory desk', error);
    return memoryDesk();
  }
}

function openIndexedDb(): Promise<BunkerDb> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('notes')) db.createObjectStore('notes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('rations')) db.createObjectStore('rations', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    request.onsuccess = () => resolve(wrap(request.result));
  });
}

function wrap(db: IDBDatabase): BunkerDb {
  return {
    getNotes: () => getAll<Note>(db, 'notes'),
    putNote: (note) => put(db, 'notes', note),
    deleteNote: (id) => remove(db, 'notes', id),
    getRations: () => getAll<Ration>(db, 'rations'),
    putRation: (ration) => put(db, 'rations', ration),
    deleteRation: (id) => remove(db, 'rations', id),
    getKv: (key) => getKey(db, key),
    putKv: (key, value) => putKey(db, key, value),
  };
}

async function seedIfNeeded(db: BunkerDb): Promise<void> {
  const seeded = await db.getKv<boolean>('seeded');
  if (seeded) return;
  const now = Date.now();
  await db.putNote({ id: DEMO_NOTE_ID, body: DEMO_NOTE_BODY, updatedAt: now });
  for (const [index, text] of DEMO_RATIONS.entries()) {
    await db.putRation({
      id: `ration-seed-${index}`,
      text,
      done: false,
      createdAt: now + index,
    });
  }
  await db.putKv('seeded', true);
}

function getAll<T>(db: IDBDatabase, store: string): Promise<T[]> {
  return run(db, store, 'readonly', (objectStore) => objectStore.getAll() as IDBRequest<T[]>);
}

function put(db: IDBDatabase, store: string, value: unknown): Promise<void> {
  return run(db, store, 'readwrite', (objectStore) => objectStore.put(value)).then(() => undefined);
}

function remove(db: IDBDatabase, store: string, key: string): Promise<void> {
  return run(db, store, 'readwrite', (objectStore) => objectStore.delete(key)).then(() => undefined);
}

function getKey<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return run(db, 'kv', 'readonly', (objectStore) => objectStore.get(key) as IDBRequest<T | undefined>);
}

function putKey(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return run(db, 'kv', 'readwrite', (objectStore) => objectStore.put(value, key)).then(() => undefined);
}

function run<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  work: (objectStore: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const request = work(tx.objectStore(store));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.onerror = () => reject(tx.error);
  });
}

/** Session-only desk used when IndexedDB cannot be opened. */
function memoryDesk(): BunkerDb {
  const notes = new Map<string, Note>();
  const rations = new Map<string, Ration>();
  const kv = new Map<string, unknown>();
  const now = Date.now();
  notes.set(DEMO_NOTE_ID, { id: DEMO_NOTE_ID, body: DEMO_NOTE_BODY, updatedAt: now });
  DEMO_RATIONS.forEach((text, index) => {
    const id = `ration-seed-${index}`;
    rations.set(id, { id, text, done: false, createdAt: now + index });
  });
  kv.set('seeded', true);
  return {
    async getNotes() {
      return [...notes.values()];
    },
    async putNote(note) {
      notes.set(note.id, note);
    },
    async deleteNote(id) {
      notes.delete(id);
    },
    async getRations() {
      return [...rations.values()];
    },
    async putRation(ration) {
      rations.set(ration.id, ration);
    },
    async deleteRation(id) {
      rations.delete(id);
    },
    async getKv<T>(key: string) {
      return kv.get(key) as T | undefined;
    },
    async putKv(key, value) {
      kv.set(key, value);
    },
  };
}
