import { useEffect, useRef, useState } from 'react';
import { MicrophoneError, startListening, type Listener } from '../audio/mic';
import { frequencyFromMidi } from '../audio/pitch';
import { spellInKey, type Key } from '../music/key';
import { spelledName } from '../music/pitch';

interface MicCheckProps {
  musicKey: Key;
  onClose: () => void;
}

/**
 * A tuner-style check that the microphone hears the guitar: shows the note
 * sounding now, how far off pitch it is, the input level and the notes heard.
 */
export default function MicCheck({ musicKey, onClose }: MicCheckProps) {
  const [error, setError] = useState<string | null>(null);
  const [pitch, setPitch] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const [notes, setNotes] = useState<number[]>([]);
  const [open, setOpen] = useState(false);
  const listenerRef = useRef<Listener | null>(null);

  useEffect(() => () => void listenerRef.current?.stop(), []);

  const start = async () => {
    setError(null);
    try {
      const listener = await startListening({
        record: false,
        onUpdate: (state) => {
          setPitch(state.currentPitch);
          setLevel(state.level);
          setNotes(state.notes.map((n) => n.midi));
        },
      });
      listener.arm();
      listenerRef.current = listener;
      setOpen(true);
    } catch (e) {
      setError(e instanceof MicrophoneError ? e.message : (e as Error).message);
    }
  };

  const close = async () => {
    await listenerRef.current?.stop();
    listenerRef.current = null;
    onClose();
  };

  const midi = pitch === null ? null : Math.round(pitch);
  const cents = pitch === null || midi === null ? 0 : Math.round(1200 * Math.log2(frequencyFromMidi(pitch) / frequencyFromMidi(midi)));
  const name = midi === null ? '–' : `${spelledName(spellInKey(midi, musicKey))}${spellInKey(midi, musicKey).octave}`;

  return (
    <div className="card-backdrop" onClick={() => void close()} role="presentation">
      <section className="card" role="dialog" aria-modal="true" aria-labelledby="mic-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="mic-title">Microphone check</h2>
        <p>Play single notes on the guitar. The note the app hears appears below, with how far off pitch it is. Nothing is recorded or sent anywhere.</p>
        {!open ? (
          <div className="controls">
            <button className="primary big" onClick={() => void start()}>
              Open the microphone
            </button>
          </div>
        ) : (
          <>
            <div className="tuner">
              <div className="tuner-note">{name}</div>
              <div className={`tuner-cents${Math.abs(cents) <= 10 ? ' in-tune' : ''}`}>{midi === null ? 'listening…' : `${cents > 0 ? '+' : ''}${cents} cents`}</div>
            </div>
            <div className="listen-meter" aria-hidden="true">
              <div className="meter-bar live" style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
            <p className="muted">
              Notes heard: {notes.length === 0 ? 'none yet' : notes.map((m) => spelledName(spellInKey(m, musicKey)) + spellInKey(m, musicKey).octave).join(' ')}
            </p>
          </>
        )}
        {error && <p className="error">{error}</p>}
        <div className="controls">
          <button onClick={() => void close()}>Close</button>
        </div>
      </section>
    </div>
  );
}
