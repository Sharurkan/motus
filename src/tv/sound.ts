interface Tone {
  frequency: number;
  /** Slides to this frequency over the tone. */
  endFrequency?: number;
  duration: number;
  type?: OscillatorType;
  volume?: number;
  /** Seconds after "now". */
  delay?: number;
}

const MASTER_VOLUME = 0.7;
const DEFAULT_VOLUME = 0.3;
const SILENT = 0.0001;

/** Original sounds made with Web Audio: no audio file, nothing from the show. */
export interface Sound {
  /** Must be called from a user gesture (remote OK button), or browsers keep audio muted. */
  unlock(): Promise<boolean>;
  isUnlocked(): boolean;
  beep(): void;
  tick(): void;
  /** One letter of a line: red, yellow or absent. */
  placed(): void;
  misplaced(): void;
  absent(): void;
  /** A letter shown at the start of a word or as a bonus. */
  pop(): void;
  refused(): void;
  found(): void;
  ballDrop(): void;
  blackBall(): void;
  motus(): void;
  start(): void;
}

/** Returns null when Web Audio is not available. */
export function createSound(): Sound | null {
  if (typeof AudioContext === 'undefined') return null;
  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = MASTER_VOLUME;
  master.connect(context.destination);
  const noise = createNoiseBuffer(context);

  function envelope(volume: number, start: number, duration: number): GainNode {
    const gain = context.createGain();
    gain.gain.setValueAtTime(SILENT, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(SILENT, start + duration);
    gain.connect(master);
    return gain;
  }

  function play(tone: Tone): void {
    if (context.state !== 'running') return;
    const start = context.currentTime + (tone.delay ?? 0);
    const oscillator = context.createOscillator();
    oscillator.type = tone.type ?? 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    if (tone.endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(tone.endFrequency, start + tone.duration);
    }
    oscillator.connect(envelope(tone.volume ?? DEFAULT_VOLUME, start, tone.duration));
    oscillator.start(start);
    oscillator.stop(start + tone.duration);
  }

  function click(): void {
    if (context.state !== 'running') return;
    const start = context.currentTime;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    source.buffer = noise;
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    source.connect(filter).connect(envelope(0.5, start, 0.03));
    source.start(start);
    source.stop(start + 0.03);
  }

  function chord(frequencies: readonly number[], options: Omit<Tone, 'frequency'>): void {
    for (const frequency of frequencies) play({ ...options, frequency });
  }

  const beep = (): void => {
    play({ frequency: 880, duration: 0.15 });
  };

  return {
    unlock: async () => {
      try {
        await context.resume();
      } catch {
        return false;
      }
      beep();
      return context.state === 'running';
    },
    isUnlocked: () => context.state === 'running',
    beep,
    tick: click,
    placed: () => {
      // Bright and firm: a well placed letter.
      play({ frequency: 784, duration: 0.18, type: 'square', volume: 0.12 });
      play({ frequency: 1568, duration: 0.12, volume: 0.1 });
    },
    misplaced: () => {
      // Softer and rounder: present but elsewhere.
      play({ frequency: 523, duration: 0.2, type: 'triangle', volume: 0.25 });
    },
    absent: () => {
      play({ frequency: 196, duration: 0.12, type: 'triangle', volume: 0.12 });
    },
    pop: () => {
      play({ frequency: 990, duration: 0.15, type: 'triangle', volume: 0.18 });
    },
    refused: () => {
      // Two close low notes beat against each other, like a buzzer.
      play({ frequency: 110, duration: 0.6, type: 'square', volume: 0.12 });
      play({ frequency: 116, duration: 0.6, type: 'square', volume: 0.12 });
    },
    found: () => {
      [523, 659, 784].forEach((frequency, index) => {
        play({ frequency, duration: 0.2, type: 'triangle', delay: index * 0.13 });
      });
      chord([523, 659, 784, 1047], { duration: 0.9, type: 'triangle', volume: 0.15, delay: 0.42 });
    },
    ballDrop: () => {
      play({ frequency: 660, endFrequency: 330, duration: 0.25, type: 'triangle', volume: 0.25 });
      play({ frequency: 1320, duration: 0.4, volume: 0.12, delay: 0.25 });
    },
    blackBall: () => {
      [0, 0.45, 0.9].forEach((delay, index) => {
        const from = 330 - index * 60;
        play({
          frequency: from,
          endFrequency: from * 0.75,
          duration: 0.4,
          type: 'sawtooth',
          volume: 0.15,
          delay,
        });
      });
    },
    motus: () => {
      [392, 523, 659, 784, 1047].forEach((frequency, index) => {
        play({ frequency, duration: 0.18, type: 'square', volume: 0.12, delay: index * 0.1 });
      });
      chord([523, 659, 784, 1047], { duration: 1.2, type: 'triangle', volume: 0.15, delay: 0.55 });
    },
    start: () => {
      [392, 523, 659].forEach((frequency, index) => {
        play({ frequency, duration: 0.25, type: 'triangle', volume: 0.2, delay: index * 0.12 });
      });
    },
  };
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.05), context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
