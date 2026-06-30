import type { RemovalFxPlan } from "./fx";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type ToneOptions = {
  frequency: number;
  duration: number;
  gain: number;
  delay?: number;
  type?: OscillatorType;
};

export type MusicStep = {
  frequency: number;
  duration: number;
  gain: number;
};

const MUSIC_SCALE = [392, 440, 523.25, 587.33, 659.25, 783.99];
const MUSIC_MOTIF = [0, 2, 4, 2, 1, 3, 5, 3];
const AUDIO_STORAGE_KEY = "gem-blocks-audio-enabled-v1";

export function musicStepForBeat(beat: number): MusicStep {
  const index = MUSIC_MOTIF[((beat % MUSIC_MOTIF.length) + MUSIC_MOTIF.length) % MUSIC_MOTIF.length];
  const accented = beat % 4 === 0;

  return {
    frequency: MUSIC_SCALE[index],
    duration: accented ? 0.38 : 0.22,
    gain: accented ? 0.032 : 0.022
  };
}

export class GemAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private musicTimer?: number;
  private beat = 0;
  private enabledValue = true;

  constructor(private readonly storageKey = AUDIO_STORAGE_KEY) {
    this.enabledValue = this.readEnabled();
  }

  get enabled() {
    return this.enabledValue;
  }

  async unlock() {
    if (!this.enabledValue) {
      return;
    }
    const context = this.ensureContext();
    if (context?.state === "suspended") {
      await context.resume();
    }
  }

  setEnabled(enabled: boolean) {
    this.enabledValue = enabled;
    this.writeEnabled(enabled);
    if (!enabled) {
      this.stopMusic();
    }
  }

  async toggle() {
    this.setEnabled(!this.enabledValue);
    if (this.enabledValue) {
      await this.unlock();
      this.playSelect();
    }
  }

  startMusic() {
    if (!this.enabledValue || this.musicTimer !== undefined) {
      return;
    }
    void this.unlock().then(() => {
      if (!this.enabledValue || this.musicTimer !== undefined) {
        return;
      }
      const playBeat = () => {
        if (!this.enabledValue) {
          return;
        }
        const step = musicStepForBeat(this.beat);
        this.playTone({ ...step, type: this.beat % 4 === 0 ? "triangle" : "sine" });
        if (this.beat % 8 === 0) {
          this.playTone({ frequency: step.frequency / 2, duration: 0.5, gain: 0.018, type: "sine" });
        }
        this.beat += 1;
      };
      playBeat();
      this.musicTimer = window.setInterval(playBeat, 430);
    });
  }

  stopMusic() {
    if (this.musicTimer !== undefined) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = undefined;
    }
  }

  destroy() {
    this.stopMusic();
    this.master?.disconnect();
    this.context = undefined;
    this.master = undefined;
  }

  playSelect() {
    this.playTone({ frequency: 1174.66, duration: 0.08, gain: 0.045, type: "sine" });
  }

  playSwap() {
    this.playTone({ frequency: 587.33, duration: 0.1, gain: 0.038, type: "triangle" });
    this.playTone({ frequency: 783.99, duration: 0.1, gain: 0.034, delay: 0.055, type: "triangle" });
  }

  playInvalid() {
    this.playTone({ frequency: 220, duration: 0.1, gain: 0.036, type: "sawtooth" });
    this.playTone({ frequency: 196, duration: 0.08, gain: 0.028, delay: 0.075, type: "sawtooth" });
  }

  playHint() {
    this.playTone({ frequency: 1567.98, duration: 0.09, gain: 0.035, type: "sine" });
    this.playTone({ frequency: 1975.53, duration: 0.12, gain: 0.026, delay: 0.07, type: "sine" });
  }

  playShuffle() {
    this.playNoise(0.18, 0.035);
    this.playTone({ frequency: 329.63, duration: 0.16, gain: 0.032, type: "triangle" });
  }

  playLevelStart() {
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      this.playTone({ frequency, duration: 0.16, gain: 0.034, delay: index * 0.07, type: "triangle" });
    });
  }

  playLevelClear() {
    [783.99, 987.77, 1318.51, 1567.98].forEach((frequency, index) => {
      this.playTone({ frequency, duration: 0.18, gain: 0.04, delay: index * 0.08, type: "sine" });
    });
  }

  playGameOver() {
    [392, 329.63, 261.63].forEach((frequency, index) => {
      this.playTone({ frequency, duration: 0.22, gain: 0.032, delay: index * 0.11, type: "triangle" });
    });
  }

  playClear(plan: RemovalFxPlan, combo: number) {
    this.playNoise(0.12, 0.022 + Math.min(combo, 4) * 0.006);
    plan.chimeNotes.forEach((frequency, index) => {
      this.playTone({
        frequency,
        duration: 0.12 + index * 0.015,
        gain: 0.04,
        delay: index * 0.045,
        type: "sine"
      });
    });
  }

  private playTone(options: ToneOptions) {
    if (!this.enabledValue) {
      return;
    }
    const context = this.ensureContext();
    if (!context || !this.master) {
      return;
    }

    const start = context.currentTime + (options.delay ?? 0);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = options.type ?? "sine";
    oscillator.frequency.setValueAtTime(options.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.gain, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + options.duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + options.duration + 0.03);
  }

  private playNoise(duration: number, gainLevel: number) {
    if (!this.enabledValue) {
      return;
    }
    const context = this.ensureContext();
    if (!context || !this.master) {
      return;
    }

    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / data.length);
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "highpass";
    filter.frequency.value = 1800;
    gain.gain.value = gainLevel;
    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    source.start();
  }

  private ensureContext() {
    if (typeof window === "undefined") {
      return undefined;
    }
    if (!this.context) {
      const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContextCtor) {
        return undefined;
      }
      this.context = new AudioContextCtor();
      this.master = this.context.createGain();
      this.master.gain.value = 0.52;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  private readEnabled() {
    if (typeof localStorage === "undefined") {
      return true;
    }
    return localStorage.getItem(this.storageKey) !== "false";
  }

  private writeEnabled(enabled: boolean) {
    try {
      localStorage.setItem(this.storageKey, String(enabled));
    } catch {
      // Audio preference is optional; gameplay should continue when storage is unavailable.
    }
  }
}
