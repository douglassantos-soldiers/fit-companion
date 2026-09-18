/** Optional session feedback: haptic + short Web Audio beeps. */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    if (!audioCtx) audioCtx = new Ctx();
    return audioCtx;
  } catch {
    return null;
  }
}

export function sessionPulse(enabled: boolean, pattern: number | number[] = 40) {
  if (!enabled || typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* ignore */
  }
}

export function sessionBeep(enabled: boolean, freq = 880, durationMs = 80) {
  if (!enabled) return;
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().then(() => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
    osc.stop(now + durationMs / 1000 + 0.02);
  });
}

export function fxSetDone(enabled: boolean) {
  sessionPulse(enabled, 40);
  sessionBeep(enabled, 720, 70);
}

export function fxRestEnd(enabled: boolean) {
  sessionPulse(enabled, [80, 40, 80]);
  sessionBeep(enabled, 980, 100);
}

export function fxExerciseDone(enabled: boolean) {
  sessionPulse(enabled, [50, 30, 50]);
  sessionBeep(enabled, 640, 90);
}
