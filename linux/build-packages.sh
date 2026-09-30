#!/bin/sh
# Builds the Linux Mint / Ubuntu packages from dist/guitar-reading-trainer.html
# (run `npm run build && node tools/single-file.mjs` first).
# Run on Linux (or WSL):  VERSION=0.1.0 sh linux/build-packages.sh
#   dist/guitar-reading-trainer_<version>_all.deb  double-click to install (menu entry + icon)
#   dist/GuitarReadingTrainer.run                  single file, runs without installing
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${VERSION:-0.1.0}"
HTML="$ROOT/dist/guitar-reading-trainer.html"
[ -f "$HTML" ] || { echo "Missing $HTML - run: npm run build && node tools/single-file.mjs" >&2; exit 1; }
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

# ---- .deb ----
PKG="$WORK/guitar-reading-trainer"
mkdir -p "$PKG/DEBIAN" "$PKG/usr/bin" "$PKG/usr/share/guitar-reading-trainer" \
  "$PKG/usr/share/applications" "$PKG/usr/share/icons/hicolor/scalable/apps"
install -m 644 "$HTML" "$PKG/usr/share/guitar-reading-trainer/guitar-reading-trainer.html"
install -m 755 "$ROOT/linux/guitar-reading-trainer.sh" "$PKG/usr/bin/guitar-reading-trainer"
install -m 644 "$ROOT/linux/guitar-reading-trainer.svg" "$PKG/usr/share/icons/hicolor/scalable/apps/guitar-reading-trainer.svg"
cat > "$PKG/usr/share/applications/guitar-reading-trainer.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Guitar Reading Trainer
Comment=Hear a melody on the fretboard, write it on the staff, learn from every mistake
Exec=guitar-reading-trainer
Icon=guitar-reading-trainer
Terminal=false
Categories=AudioVideo;Audio;Music;Education;
DESKTOP
chmod 644 "$PKG/usr/share/applications/guitar-reading-trainer.desktop"
SIZE="$(du -sk "$PKG/usr" | cut -f1)"
cat > "$PKG/DEBIAN/control" <<CONTROL
Package: guitar-reading-trainer
Version: $VERSION
Architecture: all
Maintainer: Philip van der Walt <theaminstitute@gmail.com>
Installed-Size: $SIZE
Recommends: chromium | google-chrome-stable | firefox
Section: sound
Priority: optional
Description: Learn to read guitar notation by ear
 Hear a short melody played on a sampled guitar, watch it on the fretboard,
 write it on a treble staff, and get every mistake graded and explained.
 Melodies start at one bar and grow as you improve.
CONTROL
dpkg-deb --root-owner-group --build "$PKG" "$ROOT/dist/guitar-reading-trainer_${VERSION}_all.deb" >/dev/null

# ---- single-file .run ----
RUN="$ROOT/dist/GuitarReadingTrainer.run"
{
  cat <<'HEADER'
#!/bin/sh
# Guitar Reading Trainer - single-file app for Linux Mint / Ubuntu. Nothing to install:
# right-click > Properties > Permissions > "Allow executing file as program",
# then double-click it (choose "Run").
PAGE="${XDG_DATA_HOME:-$HOME/.local/share}/guitar-reading-trainer/guitar-reading-trainer.html"
mkdir -p "$(dirname "$PAGE")"
sed '1,/^__PAYLOAD_BELOW__$/d' "$0" > "$PAGE"
HEADER
  sed -n '/^# ---- launch ----$/,$p' "$ROOT/linux/guitar-reading-trainer.sh"
  printf 'exit 0\n__PAYLOAD_BELOW__\n'
  cat "$HTML"
} > "$RUN"
chmod 755 "$RUN"
echo "Built dist/guitar-reading-trainer_${VERSION}_all.deb and dist/GuitarReadingTrainer.run (version $VERSION)"
