/**
 * The instrument being learnt (R41), for every component that draws a staff or a
 * fretboard: App provides the one chosen on the start screen; guitar by default.
 */
import { createContext, useContext } from 'react';
import { GUITAR, type Instrument } from '../music/instrument';

export const InstrumentContext = createContext<Instrument>(GUITAR);

export function useInstrument(): Instrument {
  return useContext(InstrumentContext);
}
