/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Shared shapes for notes, rations, and the tube's state.
 */

/** What the companion can do with the note on the desk. */
export type Task = 'summarise' | 'roast' | 'rewrite';

/** A note that never leaves the device. */
export interface Note {
  id: string;
  body: string;
  updatedAt: number;
}

/** One survival ration on the offline checklist. */
export interface Ration {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
}

/** Whether the radio is up. "Checking" is not a resting state. */
export type LinkState = 'online' | 'offline';

/** Where the words are coming from. */
export interface EngineStatus {
  mode: 'checking' | 'stocking' | 'ready' | 'scripted';
  /** 0 to 1 while the model is hauling. */
  progress: number;
  detail: string;
}

/** Everything the screen needs in one place. */
export interface AppState {
  link: LinkState;
  /** True after the first real connectivity decision. */
  probed: boolean;
  notes: Note[];
  activeNoteId: string | null;
  rations: Ration[];
  /** Epoch ms of the last confirmed online moment, or null if we have none. */
  lastOnlineAt: number | null;
  soundOn: boolean;
  engine: EngineStatus;
  output: string;
  outputTask: Task | null;
  busy: boolean;
  shell: 'waiting' | 'cached';
}
