import type { Theme } from './progression';

/** A colour theme the learner can pick on the start screen. The colours themselves are CSS tokens in styles.css. */
export interface ThemeInfo {
  id: Theme;
  label: string;
  /** Dark or light (status bar icons, the browser bar colour); null for Auto, which follows the device. */
  dark: boolean | null;
  /** Page background and accent: the browser bar colour and the picker swatch. */
  bg: string;
  accent: string;
}

export const THEMES: readonly ThemeInfo[] = [
  { id: 'system', label: 'Auto', dark: null, bg: '#14181f', accent: '#efeae2' },
  { id: 'light', label: 'Light', dark: false, bg: '#efeae2', accent: '#2b6cb0' },
  { id: 'dark', label: 'Dark', dark: true, bg: '#14181f', accent: '#4f8fe8' },
  { id: 'midnight', label: 'Midnight', dark: true, bg: '#000000', accent: '#3fb6d9' },
  { id: 'plum', label: 'Plum dusk', dark: true, bg: '#19141f', accent: '#a77bf0' },
  { id: 'frost', label: 'Frost', dark: false, bg: '#eef2f7', accent: '#4c5fd5' },
  { id: 'contrast', label: 'High contrast', dark: true, bg: '#000000', accent: '#ffffff' },
];

export const isTheme = (value: unknown): value is Theme => THEMES.some((t) => t.id === value);
