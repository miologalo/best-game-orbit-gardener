// All sound is synthesized with WebAudio — no audio files, no network.
// Every effect is a short oscillator or noise burst with a gain envelope.
// The context is created on the first user gesture (browsers block audio
// before one), and every call before that is a silent no-op.
export function createSoundFX() {
  let context = null;
  let master = null;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return context;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0.45;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  function tone(freq, duration, type = 'sine', volume = 0.5, slideTo = null, delay = 0) {
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), start + duration);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise(duration, volume = 0.5, lowpass = 800, delay = 0) {
    const ctx = ensure();
    if (!ctx) return;
    const start = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  return {
    // Call from the first click / key press so later sounds are allowed.
    unlock() {
      ensure();
    },
    click() {
      tone(660, 0.07, 'triangle', 0.25);
    },
    hop() {
      tone(300, 0.16, 'sine', 0.3, 520);
    },
    plant() {
      tone(420, 0.12, 'sine', 0.4, 260);
      noise(0.08, 0.12, 1200);
    },
    water() {
      tone(880, 0.14, 'sine', 0.22, 440);
      tone(1320, 0.1, 'sine', 0.12, 990, 0.05);
    },
    bloom() {
      // A little rising arpeggio when a flower opens.
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, 0.22, 'triangle', 0.3, null, i * 0.07));
    },
    cure() {
      tone(392, 0.12, 'sine', 0.3, 587);
      tone(587, 0.14, 'sine', 0.25, 784, 0.08);
    },
    blight() {
      tone(160, 0.35, 'sawtooth', 0.16, 90);
    },
    wither() {
      tone(220, 0.25, 'triangle', 0.2, 110);
    },
    warning() {
      tone(740, 0.12, 'square', 0.14);
      tone(740, 0.12, 'square', 0.14, null, 0.16);
    },
    impact() {
      noise(0.4, 0.6, 500);
      tone(90, 0.35, 'sine', 0.55, 40);
    },
    hurt() {
      tone(220, 0.25, 'sawtooth', 0.3, 110);
    },
    win() {
      [523, 659, 784, 1047, 1319].forEach((freq, i) => tone(freq, 0.35, 'triangle', 0.32, null, i * 0.09));
    },
    lose() {
      [392, 330, 262, 196].forEach((freq, i) => tone(freq, 0.4, 'triangle', 0.28, null, i * 0.12));
    },
  };
}
