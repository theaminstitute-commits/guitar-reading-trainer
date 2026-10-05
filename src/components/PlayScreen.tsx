import { useCallback, useEffect, useRef, useState } from 'react';
import { MicrophoneError, startListening, type Listener, type ListeningState, type Take } from '../audio/mic';
import { sharedPlayer } from '../audio/player';
import type { LevelConfig } from '../melody/levelConfig';
import { tonicReference } from '../melody/tonic';
import type { Melody } from '../melody/types';
import { keyName, spellInKey } from '../music/key';
import { spelledName } from '../music/pitch';
import MelodyStaff from './MelodyStaff';

interface PlayScreenProps {
  melody: Melody;
  level: LevelConfig;
  /** Listen to the app's own guitar instead of the microphone, and play the melody itself (testing aid). */
  selfPlay?: boolean;
  /** Free-running click at the melody tempo while the learner plays. */
  metronome: boolean;
  onMetronome: (on: boolean) => void;
  onDone: (take: Take) => void;
}

type Status = 'idle' | 'opening' | 'reference' | 'listening' | 'stopping';

/** Stop on our own after this much silence following the last note. */
const SILENCE_AFTER_LAST_NOTE = 2.5;
/** Hard cap on a take. */
const MAX_SECONDS = 60;

/**
 * Read and play: the melody is shown as a plain score, the learner plays it on
 * the guitar, the microphone listens. Only the tones and their number are
 * graded, so the learner can take their time.
 */
export default function PlayScreen({ melody, level, selfPlay = false, metronome, onMetronome, onDone }: PlayScreenProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);
  const [heard, setHeard] = useState(0);
  const [level_, setLevel] = useState(0);
  const listenerRef = useRef<Listener | null>(null);
  const stateRef = useRef<ListeningState | null>(null);
  const armedAtRef = useRef(0);
  const doneRef = useRef(false);

  const tonicName = spelledName(spellInKey(tonicReference(melody), melody.key));

  // Reset for a new melody.
  useEffect(() => {
    doneRef.current = false;
    setStatus('idle');
    setError(null);
    setHeard(0);
    setLevel(0);
    return () => {
      void listenerRef.current?.stop();
      listenerRef.current = null;
      sharedPlayer().stop();
      sharedPlayer().stopMetronome();
    };
  }, [melody]);

  const finish = useCallback(async () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setStatus('stopping');
    const listener = listenerRef.current;
    listenerRef.current = null;
    sharedPlayer().stop();
    sharedPlayer().stopMetronome();
    const take = listener ? await listener.stop() : { notes: [], armedAt: 0, recordingUrl: null, seconds: 0 };
    onDone(take);
  }, [onDone]);

  const start = useCallback(async () => {
    setError(null);
    setStatus('opening');
    const player = sharedPlayer();
    try {
      await player.load();
      const listener = await startListening({
        source: selfPlay ? (player.sampler ?? undefined) : undefined,
        record: !selfPlay,
        onUpdate: (state) => {
          stateRef.current = state;
          setHeard(state.notes.length);
          setLevel(state.level);
          // Stop by ourselves once the player has clearly finished.
          const last = state.notes[state.notes.length - 1];
          const quietFor = last ? state.elapsed - (last.end ?? state.elapsed) : 0;
          const sinceArmed = state.elapsed - armedAtRef.current;
          if ((last && quietFor > SILENCE_AFTER_LAST_NOTE && last.end !== null) || sinceArmed > MAX_SECONDS) void finish();
        },
      });
      listenerRef.current = listener;
    } catch (e) {
      setStatus('idle');
      setError(e instanceof MicrophoneError ? e.message : `Could not start listening: ${(e as Error).message}`);
      return;
    }

    const arm = () => {
      const listener = listenerRef.current;
      if (!listener) return;
      armedAtRef.current = stateRef.current?.elapsed ?? 0;
      listener.arm();
      setStatus('listening');
      if (metronome) {
        // The click goes to the speakers, so the listener skips the frames that contain it.
        void player.startMetronome(melody.tempo, melody.barBeats, (time) => listener.ignoreAround(time));
      }
      if (selfPlay) {
        void player.play(melody.notes, { tempo: melody.tempo, timeSignature: melody.timeSignature, countIn: false }, {});
      }
    };

    if (level.tonicReference) {
      // The key note sounds first; listening starts once it has died away so the
      // microphone does not pick it up as the first note.
      setStatus('reference');
      await player.play(
        [],
        { tempo: melody.tempo, timeSignature: melody.timeSignature, countIn: false, reference: { midi: tonicReference(melody), times: 2 } },
        { onEnd: () => setTimeout(arm, 700) },
      );
    } else {
      arm();
    }
  }, [finish, level.tonicReference, melody, selfPlay, metronome]);

  const busy = status === 'opening' || status === 'reference' || status === 'listening' || status === 'stopping';

  return (
    <section className="exercise play">
      <div className="status-line" aria-live="polite">
        {status === 'idle' && `Read the melody, then play it on your guitar. ${selfPlay ? 'Self-play check: the app plays it for you.' : 'The microphone listens while you play.'}`}
        {status === 'opening' && 'Opening the microphone…'}
        {status === 'reference' && `Key note: ${tonicName}. The melody is in ${keyName(melody.key)}. Play when it fades.`}
        {status === 'listening' && `Listening. Notes heard: ${heard}. Tap Done when you have finished, or just stop playing.`}
        {status === 'stopping' && 'Working out what you played…'}
      </div>

      <MelodyStaff melody={melody} musicKey={melody.key} />

      <div className="listen-meter" aria-hidden="true">
        <div className={`meter-bar${status === 'listening' ? ' live' : ''}`} style={{ width: `${Math.round(level_ * 100)}%` }} />
      </div>

      {error && <p className="error">{error}</p>}

      <div className="controls">
        {!busy ? (
          <button className="primary big" onClick={() => void start()}>
            {selfPlay ? 'Run self-play check' : 'Start playing'}
          </button>
        ) : (
          <button className="primary big" onClick={() => void finish()} disabled={status !== 'listening'}>
            Done
          </button>
        )}
      </div>
      <label className="toggle muted">
        <input type="checkbox" checked={metronome} onChange={(e) => onMetronome(e.target.checked)} disabled={busy} /> Metronome while I play ({melody.tempo} bpm)
      </label>
      <p className="muted small-note">
        Only the notes and how many you play are graded, not the timing. Headphones are not needed; the key note is played before listening starts.
      </p>
    </section>
  );
}
