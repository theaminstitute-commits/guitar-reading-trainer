#!/bin/sh
# Removes Guitar Reading Trainer and its menu entry. Progress saved in the app profile is removed too.
DATA="${XDG_DATA_HOME:-$HOME/.local/share}"
rm -rf "$DATA/guitar-reading-trainer" "${XDG_CONFIG_HOME:-$HOME/.config}/guitar-reading-trainer"
rm -f "$DATA/applications/guitar-reading-trainer.desktop"
update-desktop-database "$DATA/applications" >/dev/null 2>&1 || true
echo "Guitar Reading Trainer removed."
