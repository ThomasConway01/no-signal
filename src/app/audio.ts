/**
 * Written by Thomas Conway.
 * NO SIGNAL — a bunker assistant for Hackyard Yard #6 (Offline).
 * Original Web Audio: a sick carrier when the signal is up, a low fifth
 * when the bunker is open. Nothing is fetched. Nothing plays until the
 * sound button is pressed, because browsers require a gesture.
 */

type Scene = 'signal' | 'bunker';

export class BunkerAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private scene: Scene = 'signal';
  private enabled = false;
  private oscillators: OscillatorNode[] = [];
  private sources: AudioBufferSourceNode[] = [];
  private nodes: AudioNode[] = [];
  private timer = 0;
  private noise: AudioBuffer | null = null;

  toggle(): boolean {
    if (typeof AudioContext === 'undefined') return false;
    this.ensure();
    this.enabled = !this.enabled;
    this.applyGain();
    if (this.enabled) {
      void this.ctx?.resume();
      this.rebuild();
    } else {
      this.teardownScene();
    }
    return this.enabled;
  }

  /** Remember which room we're in. Rebuild only if the speaker is live. */
  setScene(scene: Scene): void {
    if (this.scene === scene) return;
    this.scene = scene;
    if (this.enabled) this.rebuild();
  }

  /** A short click for buttons. Silent when sound is off. */
  blip(): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = this.scene === 'bunker' ? 392 : 110;
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  private ensure(): void {
    if (this.ctx) return;
    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
  }

  private applyGain(): void {
    if (!this.ctx || !this.master) return;
    this.master.gain.setTargetAtTime(this.enabled ? 0.85 : 0, this.ctx.currentTime, 0.03);
  }

  private rebuild(): void {
    this.teardownScene();
    if (!this.enabled || !this.ctx || !this.master) return;
    if (this.scene === 'bunker') this.drone();
    else this.staticBed();
  }

  /** Two quiet sines a fifth apart. The kettle, more or less. */
  private drone(): void {
    if (!this.ctx || !this.master) return;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    filter.connect(this.master);
    this.nodes.push(filter);
    for (const frequency of [98, 147]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      gain.gain.value = 0.045;
      osc.connect(gain);
      gain.connect(filter);
      osc.start();
      this.oscillators.push(osc);
      this.nodes.push(gain);
    }
  }

  /** Band-passed noise plus a rude little beep. */
  private staticBed(): void {
    if (!this.ctx || !this.master) return;
    const buffer = this.noiseBuffer();
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1600;
    filter.Q.value = 0.6;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.04;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
    this.sources.push(source);
    this.nodes.push(filter, gain);
    this.beep(180, 0.09);
    this.timer = window.setInterval(() => this.beep(140, 0.07), 4200);
  }

  private beep(frequency: number, seconds: number): void {
    if (!this.enabled || !this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise && this.ctx) return this.noise;
    const ctx = this.ctx;
    if (!ctx) throw new Error('Audio context missing');
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    this.noise = buffer;
    return buffer;
  }

  private teardownScene(): void {
    window.clearInterval(this.timer);
    this.timer = 0;
    for (const osc of this.oscillators) {
      try {
        osc.stop();
      } catch {
        // Already stopped.
      }
      osc.disconnect();
    }
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      source.disconnect();
    }
    for (const node of this.nodes) node.disconnect();
    this.oscillators = [];
    this.sources = [];
    this.nodes = [];
  }
}
