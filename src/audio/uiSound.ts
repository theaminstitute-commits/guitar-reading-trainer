/**
 * Button feedback (R34): a soft felt-key thud on every button press, quiet
 * under the guitar. Buttons that already sound a note (Play, Hear it, letter
 * picks, the tap pad) carry data-sound="none" and stay silent here. It plays in
 * the app's one audio context (R35) and needs no samples, so it never waits.
 */
import { audioContext, unlockAudio } from './unlock';

let enabled = true;

export function setButtonSounds(on: boolean): void {
  enabled = on;
}

function context(): AudioContext | null {
  unlockAudio();
  try {
    return audioContext();
  } catch {
    return null;
  }
}

/** The felt key: a low triangle tone, slightly falling, through a soft low-pass, about 90 ms. */
export function feltKey(): void {
  const c = context();
  if (!c) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const gain = c.createGain();
  const lowpass = c.createBiquadFilter();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(330, t);
  osc.frequency.exponentialRampToValueAtTime(300, t + 0.09);
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 700;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.3, t + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
  osc.connect(gain).connect(lowpass).connect(c.destination);
  osc.start(t);
  osc.stop(t + 0.11);
}

/** One listener for the whole app: any enabled button press plays the felt key, unless the button sounds a note itself. */
export function installButtonSounds(): () => void {
  const onPress = (e: PointerEvent) => {
    if (!enabled || e.button !== 0) return;
    const button = (e.target as Element | null)?.closest?.('button');
    if (!button || button.disabled || button.closest('[data-sound="none"]')) return;
    feltKey();
  };
  // Pointer down rather than click: the sound lands with the finger, not after it lifts.
  document.addEventListener('pointerdown', onPress, true);
  return () => document.removeEventListener('pointerdown', onPress, true);
}
