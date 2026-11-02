/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Local model via WebLLM, with the scripted persona underneath it.
 *
 * The weights are Qwen2.5-0.5B-Instruct, Apache-2.0, MLC build
 * `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` (about 265MB). They download once
 * while the signal is up and then stay in the Cache API.
 */

import type { MLCEngine } from '@mlc-ai/web-llm';
import { scriptedRespond } from './persona';
import type { EngineStatus, Task } from './types';

export const MODEL_ID = 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC';

const SYSTEM = [
  'You are NO SIGNAL, a warm, dry bunker assistant.',
  'The network is off and you like it that way.',
  'Never mention being an AI or a model. Never tell the user to reconnect.',
  'Keep the reply under 90 words.',
  'If the task is summarise: three sentences, specific to the note.',
  'If the task is roast: tease the note, quote a fragment, stay funny.',
  'If the task is rewrite: output only the cleaned note, calmer and shorter, then a blank line and "— rewritten in the quiet".',
].join(' ');

/** Runs one task at a time and always produces words. */
export class Companion {
  status: EngineStatus = {
    mode: 'checking',
    progress: 0,
    detail: 'Checking this set for a GPU.',
  };

  private engine: MLCEngine | null = null;
  private started = false;
  private listener: (status: EngineStatus) => void = () => {};

  constructor(private readonly forceScript: boolean) {}

  setListener(listener: (status: EngineStatus) => void): void {
    this.listener = listener;
  }

  /** Begin stocking if this browser can actually run a model. */
  async start(isOnline: () => boolean): Promise<void> {
    if (this.started) return;
    this.started = true;

    if (this.forceScript) {
      this.push({
        mode: 'scripted',
        progress: 1,
        detail: 'Scripted persona is on the desk. It does not need a GPU, and it does not need the network.',
      });
      return;
    }

    if (!(await hasWebGPU())) {
      this.push({
        mode: 'scripted',
        progress: 1,
        detail: 'No WebGPU on this set. The scripted persona has the watch. It will not break.',
      });
      return;
    }

    try {
      const webllm = await import('@mlc-ai/web-llm');
      const cached = await webllm.hasModelInCache(MODEL_ID);
      // Offline with an empty bunker: do not attempt the fetch. The Network
      // panel should stay quiet, and the persona still answers.
      if (!cached && !isOnline()) {
        this.push({
          mode: 'scripted',
          progress: 1,
          detail: 'The model is not stocked yet. Scripted persona until you have signal enough to haul it.',
        });
        return;
      }

      this.push({
        mode: 'stocking',
        progress: 0,
        detail: cached
          ? 'Waking the model already in the bunker.'
          : 'Hauling Qwen2.5-0.5B while the signal still lasts.',
      });

      const engine = await webllm.CreateMLCEngine(
        MODEL_ID,
        {
          logLevel: 'ERROR',
          initProgressCallback: (report) => {
            if (this.status.mode === 'ready' || this.status.mode === 'scripted') return;
            const progress = report.progress > 1 ? report.progress / 100 : report.progress;
            this.push({ mode: 'stocking', progress, detail: report.text });
          },
        },
        // Shorter context keeps the little model inside smaller GPUs.
        { context_window_size: 2048 },
      );
      this.engine = engine;
      this.push({
        mode: 'ready',
        progress: 1,
        detail: 'Qwen2.5-0.5B is in the bunker. Pull the cable whenever you like.',
      });
    } catch (error) {
      console.warn('NO SIGNAL local model unavailable', error);
      this.engine = null;
      this.push({ mode: 'scripted', progress: 1, detail: friendlyEngineError(error) });
    }
  }

  /** Stream a reply. Falls through to the scripted persona on any failure. */
  async respond(task: Task, note: string, onDelta: (text: string) => void): Promise<void> {
    if (this.engine && this.status.mode === 'ready') {
      try {
        const text = await this.stream(task, note, onDelta);
        if (text.trim()) return;
      } catch (error) {
        console.warn('NO SIGNAL generation fell back to the scripted persona', error);
      }
    }
    await typewrite(scriptedRespond(task, note), onDelta);
  }

  private async stream(task: Task, note: string, onDelta: (text: string) => void): Promise<string> {
    const engine = this.engine;
    if (!engine) return '';
    await engine.resetChat();
    const clipped = note.slice(0, 2500);
    const chunks = await engine.chat.completions.create({
      stream: true,
      temperature: 0.6,
      max_tokens: 220,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Task: ${task}\n\nNote:\n"""\n${clipped}\n"""` },
      ],
    });
    let full = '';
    for await (const chunk of chunks) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      if (!delta) continue;
      full += delta;
      onDelta(full);
    }
    return full;
  }

  private push(partial: Partial<EngineStatus>): void {
    this.status = { ...this.status, ...partial };
    this.listener(this.status);
  }
}

async function hasWebGPU(): Promise<boolean> {
  // The DOM lib in this toolchain does not ship the WebGPU globals.
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

function friendlyEngineError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/webgpu|gpu|adapter|device/i.test(message)) {
    return 'This GPU refused the haul. The scripted persona has the watch.';
  }
  if (/fetch|network|failed|cache/i.test(message)) {
    return 'The haul broke before it landed. Scripted persona until the next signal.';
  }
  return 'The local model stayed outside. The scripted persona has the watch.';
}

/** Reveal scripted copy in small bites so the receiver feels alive. */
async function typewrite(text: string, onDelta: (text: string) => void): Promise<void> {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    onDelta(text);
    return;
  }
  const step = 12;
  for (let index = 0; index < text.length; index += step) {
    onDelta(text.slice(0, index + step));
    await delay(16);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}
