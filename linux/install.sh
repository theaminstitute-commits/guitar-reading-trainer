#!/bin/sh
# Installs Guitar Reading Trainer for the current user (no sudo) and adds it to the menu.
set -e
SRC="$(cd "$(dirname "$0")" && pwd)"
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DATA/guitar-reading-trainer"
APPS="$DATA/applications"

mkdir -p "$DEST" "$APPS"
cp "$SRC/guitar-reading-trainer.html" "$SRC/guitar-reading-trainer.sh" "$SRC/guitar-reading-trainer.svg" "$DEST/"
chmod +x "$DEST/guitar-reading-trainer.sh"

cat > "$APPS/guitar-reading-trainer.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=Guitar Reading Trainer
Comment=Hear a melody on the fretboard, write it on the staff, learn from every mistake
Exec="$DEST/guitar-reading-trainer.sh"
Icon=$DEST/guitar-reading-trainer.svg
Terminal=false
Categories=AudioVideo;Audio;Music;Education;
DESKTOP
chmod +x "$APPS/guitar-reading-trainer.desktop"
update-desktop-database "$APPS" >/dev/null 2>&1 || true

echo "Guitar Reading Trainer installed to $DEST"
echo "Open it from the menu (Sound & Video / Education), or run: $DEST/guitar-reading-trainer.sh"
if ! command -v chromium >/dev/null 2>&1 && ! command -v chromium-browser >/dev/null 2>&1 \
   && ! command -v google-chrome >/dev/null 2>&1; then
  echo "Tip: install Chromium (sudo apt install chromium) to get a separate app window; it opens in Firefox until then."
fi
