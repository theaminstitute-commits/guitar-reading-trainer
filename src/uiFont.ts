/**
 * The interface font, Plus Jakarta Sans (SIL Open Font License 1.1), bundled so the app
 * looks the same offline and on every device. Only the Latin subset: the variable file
 * covers every weight from 200 to 800 in about 27 KB. The music notation keeps its own fonts.
 */
import jakartaLatin from '@fontsource-variable/plus-jakarta-sans/files/plus-jakarta-sans-latin-wght-normal.woff2';

const face = document.createElement('style');
face.textContent = `@font-face{font-family:'Plus Jakarta Sans';font-style:normal;font-display:swap;font-weight:200 800;src:url(${jakartaLatin}) format('woff2');}`;
document.head.appendChild(face);
