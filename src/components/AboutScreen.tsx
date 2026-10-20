import appLicence from '../../LICENSE.md?raw';
import notices from '../about/licences.json';

interface Part {
  id: string;
  name: string;
  version: string;
  role: string;
  licence: string;
  copyright: string[];
  text: string;
}

const LICENCE_NAME: Record<string, string> = {
  MIT: 'MIT License',
  '0BSD': 'BSD Zero Clause License',
  'OFL-1.1': 'SIL Open Font License 1.1',
  'CC-BY-3.0': 'Creative Commons Attribution 3.0',
};

/** Joins the hard-wrapped lines of a plain-text licence into paragraphs, so it reads well on a narrow screen. */
const reflow = (text: string) => text.replace(/([^\n])\n(?!\n)/g, '$1 ');

/** Fonts and sound first, then the code libraries; they are what a reader recognises. */
const PARTS: Part[] = [...notices.assets, ...notices.packages];

/**
 * About and licences: who made the app, its own licence, and every third-party
 * part inside it with its copyright lines and full licence text, as the MIT,
 * OFL and CC BY licences require.
 */
export default function AboutScreen({ onBack }: { onBack: () => void }) {
  return (
    <section className="about">
      <div className="panel">
        <span className="eyebrow">About</span>
        <h2 className="about-title">Guitar Reading Trainer</h2>
        <p className="muted">Version {__APP_VERSION__}</p>
        <p>
          Hear a melody on the fretboard, write it on the staff, and learn from every mistake. Created and maintained by <strong>Dirk Swanepoel</strong>.
        </p>
        <p className="muted small-note">
          No account, no advertising, no tracking. Your progress is saved on this device only, and the app works offline.
        </p>
      </div>

      <div className="panel">
        <span className="eyebrow">This app's licence</span>
        <p>
          Guitar Reading Trainer is licensed under the <strong>PolyForm Noncommercial License 1.0.0</strong>. You may use, study, change and share it for any
          noncommercial purpose, including personal practice, teaching, schools and charities. Selling it, or building a paid product on it, needs a separate
          licence from the copyright holder.
        </p>
        <p className="required-notice">Required Notice: Copyright 2026 Dirk Swanepoel</p>
        <details className="licence-text">
          <summary>Show the full licence</summary>
          <pre>{appLicence.replace(/\r\n/g, '\n').replace(/^Required Notice:.*\n+/, '')}</pre>
        </details>
      </div>

      <h2 className="section-title">Made with</h2>
      <p className="muted small-note">
        These parts belong to their authors and are used under their own licences, which allow their use in this app. Each licence is reproduced in full.
      </p>
      <ul className="licence-list">
        {PARTS.map((part) => (
          <li key={part.id} className="panel tight licence-card">
            <div className="licence-head">
              <strong>{part.name}</strong>
              <span className="muted">{part.version}</span>
            </div>
            <div className="muted small-note">
              {part.role} · {LICENCE_NAME[part.licence] ?? part.licence}
            </div>
            {part.copyright.map((line) => (
              <div key={line} className="licence-copyright">
                {line}
              </div>
            ))}
            <details className="licence-text">
              <summary>Show licence</summary>
              <pre>{part.id.startsWith('font-') ? part.text : reflow(part.text)}</pre>
            </details>
          </li>
        ))}
      </ul>

      <p className="about-back">
        <button className="btn" onClick={onBack}>
          Back to start
        </button>
      </p>
    </section>
  );
}
