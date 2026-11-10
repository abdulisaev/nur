// Тихие звуки счётчика, синтезируются через Web Audio (без файлов).
let ctx;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, start, dur, gain = 0.08, type = "sine") {
  const c = ac();
  if (!c) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sound = {
  tick: () => tone(1650, 0, 0.045, 0.05, "triangle"),
  done: () => {
    tone(880, 0, 0.18, 0.06);
    tone(1318.5, 0.09, 0.26, 0.05);
  },
};
