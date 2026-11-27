/** Subtle Web Audio cues. Muted by default until the user unmutes, then remembered. */
let ctx = null;
let muted = true;

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function isMuted() { return muted; }

export function setMuted(next) {
  muted = Boolean(next);
  try { localStorage.setItem('slicebench-muted', muted ? '1' : '0'); } catch { /* ignore */ }
  if (!muted) ac();
  return muted;
}

export function loadMutePreference() {
  try {
    const saved = localStorage.getItem('slicebench-muted');
    muted = saved === null ? true : saved === '1';
  } catch {
    muted = true;
  }
  return muted;
}

function tone(freq, { duration = 0.08, type = 'sine', gain = 0.04, slide = 0, delay = 0 } = {}) {
  if (muted) return;
  const audio = ac();
  const osc = audio.createOscillator();
  const g = audio.createGain();
  const filter = audio.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1900;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audio.currentTime + delay);
  if (slide) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq + slide),
      audio.currentTime + delay + duration,
    );
  }
  g.gain.setValueAtTime(0.0001, audio.currentTime + delay);
  g.gain.exponentialRampToValueAtTime(gain, audio.currentTime + delay + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + delay + duration);
  osc.connect(filter);
  filter.connect(g);
  g.connect(audio.destination);
  osc.start(audio.currentTime + delay);
  osc.stop(audio.currentTime + delay + duration + 0.02);
}

export function blip() { tone(494, { duration: 0.05, gain: 0.028, type: 'triangle' }); }
export function whoosh() {
  tone(196, { duration: 0.24, gain: 0.03, type: 'sine', slide: 320 });
  tone(392, { duration: 0.18, gain: 0.02, type: 'triangle', slide: 180, delay: 0.05 });
}
export function chime() {
  tone(392, { duration: 0.16, gain: 0.03, type: 'sine' });
  tone(523.25, { duration: 0.2, gain: 0.028, type: 'sine', delay: 0.05 });
  tone(659.25, { duration: 0.28, gain: 0.022, type: 'triangle', delay: 0.11 });
}
export function tick() { tone(740, { duration: 0.028, gain: 0.016, type: 'square' }); }
export function warn() { tone(185, { duration: 0.16, gain: 0.028, type: 'sawtooth', slide: -36 }); }
