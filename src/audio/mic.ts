/**
 * Microphone listening for the read-and-play mode.
 *
 * Opens the microphone with the browser's voice processing switched off (echo
 * cancellation, noise suppression and automatic gain all damage a guitar
 * signal), feeds frames to a NoteTracker, and records the take so the learner
 * can hear it back. Everything stays on the device: nothing is uploaded and
 * the recording lives only in memory for the current exercise.
 *
 * `source` lets the app listen to one of its own audio nodes instead of the
 * microphone, which is how the self-play check works.
 */
import * as Tone from 'tone';
import { NoteTracker, type DetectedNote } from './noteTracker';
import { rms } from './pitch';

export interface ListeningState {
  notes: readonly DetectedNote[];
  /** 0..1 input level for a meter. */
  level: number;
  /** Fractional MIDI of the pitch sounding right now, or null. */
  currentPitch: number | null;
  /** Seconds since listening started. */
  elapsed: number;
}

export interface Take {
  notes: DetectedNote[];
  /** Seconds after listening started at which tracking and recording began; note times count from listening start. */
  armedAt: number;
  /** Object URL of the recording, or null if recording was not possible. */
  recordingUrl: string | null;
  /** Seconds listened. */
  seconds: number;
}

export interface Listener {
  /** Start tracking notes and recording. Before this, only the level is reported. */
  arm(): void;
  stop(): Promise<Take>;
}

export interface ListenOptions {
  onUpdate: (state: ListeningState) => void;
  /** Listen to this node instead of the microphone (self-play check). Any node with connect/disconnect, native or Tone.js. */
  source?: ConnectableNode;
  record?: boolean;
}

export interface ConnectableNode {
  connect(destination: AudioNode): unknown;
  disconnect(destination?: AudioNode): unknown;
}

const FRAME = 2048;
const HOP_MS = 20;

export class MicrophoneError extends Error {
  constructor(
    message: string,
    public readonly reason: 'denied' | 'unavailable' | 'insecure' | 'unknown',
  ) {
    super(message);
  }
}

function describeMicError(e: unknown): MicrophoneError {
  const name = (e as { name?: string })?.name ?? '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return new MicrophoneError('Microphone access was refused. Allow the microphone for this page and try again.', 'denied');
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return new MicrophoneError('No microphone was found on this device.', 'unavailable');
  }
  return new MicrophoneError(`Could not open the microphone: ${(e as Error)?.message ?? String(e)}`, 'unknown');
}

/** Open the microphone (or the given node) and start tracking notes. Call from a user gesture. */
export async function startListening(options: ListenOptions): Promise<Listener> {
  await Tone.start();
  const context = Tone.getContext().rawContext as AudioContext;
  if (!options.source && !navigator.mediaDevices?.getUserMedia) {
    throw new MicrophoneError('This browser cannot use the microphone here. On a phone, open the app over https.', 'insecure');
  }

  let stream: MediaStream | null = null;
  let sourceNode: ConnectableNode;
  if (options.source) {
    sourceNode = options.source;
  } else {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
        video: false,
      });
    } catch (e) {
      throw describeMicError(e);
    }
    sourceNode = context.createMediaStreamSource(stream);
  }

  const analyser = context.createAnalyser();
  analyser.fftSize = FRAME;
  analyser.smoothingTimeConstant = 0;
  sourceNode.connect(analyser);

  const tracker = new NoteTracker({ sampleRate: context.sampleRate });
  const buffer = new Float32Array(FRAME);
  const startedAt = context.currentTime;

  // Record the take for playback. Fall back silently where MediaRecorder is missing.
  let recorder: MediaRecorder | null = null;
  const chunks: Blob[] = [];
  if (options.record !== false && stream && typeof MediaRecorder !== 'undefined') {
    try {
      recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
    } catch {
      recorder = null;
    }
  }

  let armed = false;
  let armedAt = 0;
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(buffer);
    const now = context.currentTime - startedAt;
    if (armed) {
      tracker.push(buffer, now);
      options.onUpdate({ notes: tracker.notes, level: tracker.level, currentPitch: tracker.currentPitch, elapsed: now });
    } else {
      options.onUpdate({ notes: [], level: Math.min(1, rms(buffer) * 4), currentPitch: null, elapsed: now });
    }
  }, HOP_MS);

  return {
    arm() {
      if (armed) return;
      armed = true;
      armedAt = context.currentTime - startedAt;
      try {
        recorder?.start(250);
      } catch {
        recorder = null;
      }
    },
    async stop() {
      clearInterval(timer);
      const seconds = context.currentTime - startedAt;
      const notes = tracker.finish(seconds);
      try {
        sourceNode.disconnect(analyser);
      } catch {
        // already disconnected
      }
      let recordingUrl: string | null = null;
      if (recorder && recorder.state !== 'inactive') {
        await new Promise<void>((resolve) => {
          recorder!.onstop = () => resolve();
          recorder!.stop();
        });
        if (chunks.length > 0) recordingUrl = URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType }));
      }
      stream?.getTracks().forEach((t) => t.stop());
      return { notes: notes.map((n) => ({ ...n })), armedAt, recordingUrl, seconds };
    },
  };
}
