// Tiny WebAudio sound effects (no files needed) + background music toggle.
let ctx = null;
const KEY = 'pf2_music';
function tone(freq, at, dur, type = 'sine', vol = 0.12) {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  const o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + at;
  o.type = type; o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination); o.start(t); o.stop(t + dur + 0.02);
}
const PATTERNS = {
  tap: [[660, 0, 0.05]], plant: [[300, 0, 0.08], [450, 0.07, 0.1]], no: [[200, 0, 0.14, 'square', 0.06]],
  harvest: [[523, 0, 0.1], [659, 0.08, 0.1], [784, 0.16, 0.16]], coin: [[988, 0, 0.07], [1319, 0.07, 0.18]],
  level: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.3]],
};
export function sfx(name) {
  try { (PATTERNS[name] || []).forEach(([f, at, d, type, vol]) => tone(f, at, d, type, vol)); } catch { /* audio blocked until first tap */ }
}

let audio = null;
export const music = {
  enabled: localStorage.getItem(KEY) !== '0',
  start() {
    if (!this.enabled) return;
    audio ||= Object.assign(new Audio('assets/music.mp3'), { loop: true, volume: 0.3 });
    audio.play().catch(() => {});
  },
  toggle() {
    this.enabled = !this.enabled; localStorage.setItem(KEY, this.enabled ? '1' : '0');
    this.enabled ? this.start() : audio?.pause();
  },
};
// Browsers only allow audio after a tap, so start on the first one.
addEventListener('pointerdown', () => music.start(), { once: true });
