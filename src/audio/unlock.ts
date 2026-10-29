/**
 * Starting audio on phones, iPhones above all (R35).
 *
 * iOS only lets a page start sound inside a tap, and plays web audio through the
 * ring/silent switch: with the switch on silent the page is mute although the
 * volume is up. So on every tap, until sound is running:
 * - ask for "playback" audio (navigator.audioSession, iOS 17+), which ignores the
 *   silent switch like a music app; older iOS gets the same from one silent
 *   HTML audio play;
 * - resume the one audio context the app uses and play a silent sample in it.
 * Nothing ever waits on this, so a tap iOS does not accept cannot stall playback.
 */
import * as Tone from 'tone';

type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/** The app's single audio context: the guitar, the clicks and the button sounds all play here. */
export function audioContext(): AudioContext {
  return Tone.getContext().rawContext as unknown as AudioContext;
}

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** A tenth of a second of silence as a WAV data URI (8-bit mono, 8 kHz). */
function silentWav(): string {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  bytes.fill(128, 44);
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:audio/wav;base64,${btoa(binary)}`;
}

let silentPlayed = false;

/** Call from inside a tap: does whatever this browser needs for sound, and never waits. */
export function unlockAudio(): void {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (session && session.type !== 'playback') {
    try {
      session.type = 'playback';
    } catch {
      // Not allowed here: the silent HTML audio below covers it.
    }
  }
  if (isIos() && !silentPlayed && (!session || session.type !== 'playback')) {
    const tag = new Audio(silentWav());
    tag.setAttribute('playsinline', '');
    tag.play().then(
      () => (silentPlayed = true),
      () => {},
    );
  }
  const ctx = audioContext();
  // A browser without Web Audio has a stand-in context with no resume: nothing to start there.
  if (typeof ctx.resume !== 'function') return;
  if (ctx.state !== 'running') {
    ctx.resume().catch(() => {});
    try {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, 22050);
      source.connect(ctx.destination);
      source.start(0);
    } catch {
      // A closed or odd context: the next tap tries again.
    }
  }
}

/** Unlock on every kind of tap until sound runs (iOS accepts some events and not others). */
export function installAudioUnlock(): () => void {
  const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
  const onTap = () => {
    unlockAudio();
    if (audioContext().state === 'running' || typeof audioContext().resume !== 'function') remove();
  };
  const remove = () => events.forEach((e) => document.removeEventListener(e, onTap, true));
  events.forEach((e) => document.addEventListener(e, onTap, true));
  // Back from the background (a call, the lock screen): iOS may have suspended the context.
  const onVisible = () => {
    if (document.visibilityState === 'visible' && audioContext().state !== 'running') events.forEach((e) => document.addEventListener(e, onTap, true));
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    remove();
    document.removeEventListener('visibilitychange', onVisible);
  };
}
