// Restrained synthesized sound: no audio assets needed, WebAudio only.
// All sounds are short, soft, mutable, and never required for play.
let ctx: AudioContext | null = null;
let muted = false;

function ac(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

export function isMuted() {
  return muted;
}
export function setMuted(m: boolean) {
  muted = m;
}

function tone(freq: number, durMs: number, gain = 0.08, type: OscillatorType = "sine", whenMs = 0) {
  if (muted) return;
  const c = ac();
  if (!c) return;
  try {
    const t0 = c.currentTime + whenMs / 1000;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
    osc.connect(g).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + durMs / 1000 + 0.05);
  } catch {
    /* ignore */
  }
}

export const sfx = {
  step() {
    tone(180 + Math.random() * 60, 70, 0.015, "triangle");
  },
  interact() {
    tone(520, 120, 0.05);
    tone(780, 160, 0.04, "sine", 70);
  },
  clue() {
    tone(660, 180, 0.06);
    tone(880, 220, 0.06, "sine", 120);
    tone(1320, 300, 0.035, "sine", 240);
  },
  task() {
    tone(440, 150, 0.05);
    tone(660, 200, 0.05, "sine", 110);
  },
  vote() {
    tone(392, 160, 0.05);
  },
  phase() {
    tone(523, 220, 0.05);
    tone(659, 260, 0.05, "sine", 150);
  },
  win() {
    tone(523, 200, 0.06);
    tone(659, 200, 0.06, "sine", 150);
    tone(784, 340, 0.06, "sine", 300);
  },
  lose() {
    tone(392, 220, 0.05);
    tone(330, 320, 0.05, "sine", 180);
  },
  error() {
    tone(220, 150, 0.04, "square");
  },
};
