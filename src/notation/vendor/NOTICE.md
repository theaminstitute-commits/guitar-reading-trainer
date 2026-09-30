# Bundled music fonts

`bravura.ts` and `academico.ts` are copied unchanged from VexFlow 5.0.0
(`build/esm/src/fonts/`), which ships them as base64 data URIs.

- **Bravura** (SMuFL music font) by Steinberg Media Technologies, SIL Open Font License 1.1.
- **Academico** (text font) by Daniel Spreadbury and others, SIL Open Font License 1.1.
- VexFlow itself is MIT licensed (Mohit Muthanna Cheppudira and contributors).

They are copied rather than imported from the package because VexFlow's own
loader passes them to `FontFace` as `url(data:...)`, which strict Content
Security Policies (the claude.ai artifact host) refuse. `src/notation/fonts.ts`
decodes them to binary and creates the `FontFace` from an ArrayBuffer instead.
