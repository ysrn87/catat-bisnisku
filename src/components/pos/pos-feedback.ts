// Umpan balik kasir: getar (HP/tablet) dan bunyi bip singkat. Semua opsional & aman bila API tidak ada.

type FeedbackKind = 'add' | 'scan' | 'error';

let audioCtx: AudioContext | null = null;

function beep(freq: number, ms: number) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx ?? new Ctx();
    if (audioCtx.state === 'suspended') void audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.value = 0.06; // pelan: tidak mengganggu pelanggan
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + ms / 1000);
  } catch {
    /* audio tidak tersedia — abaikan */
  }
}

export function posFeedback(kind: FeedbackKind, soundOn: boolean) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(kind === 'error' ? [30, 40, 30] : kind === 'scan' ? 20 : 10);
    }
  } catch {
    /* ignore */
  }
  if (!soundOn || typeof window === 'undefined') return;
  if (kind === 'scan') beep(1400, 70);
  else if (kind === 'error') beep(220, 220);
}

/** localStorage aman (mode privat / kuota penuh tidak boleh merusak POS). */
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
