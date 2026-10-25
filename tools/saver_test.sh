#!/bin/bash
# Preview the screensaver at chosen moments (via previewShiftMinutes) and screenshot each.
#   saver_test.sh <shots-dir> "<label>=<YYYY-MM-DDTHH:MM>" ...
# Extra settings for every shot can be given as JSON in $BASE (e.g. '{"useAlbums": false}').
set -uo pipefail
SHOTS="${1:?usage: saver_test.sh <shots-dir> label=YYYY-MM-DDTHH:MM ...}"; shift; mkdir -p "$SHOTS"
cd "$(dirname "$0")/.."
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
IP=$(cat "$(dirname "$0")/../.tv-ip"); A() { "$ADB" -s "$IP:5555" "$@"; }
for spec in "$@"; do
  label="${spec%%=*}"; when="${spec#*=}"
  shift_min=$(python3 -c 'import sys,datetime as d; t=d.datetime.fromisoformat(sys.argv[1]); print(round((t-d.datetime.now()).total_seconds()/60))' "$when")
  tmp=$(mktemp)
  python3 -c 'import json,sys; d=json.loads(sys.argv[1] or "{}"); d["previewShiftMinutes"]=int(sys.argv[2]); print(json.dumps(d))' "${BASE:-}" "$shift_min" > "$tmp"
  ./tv.sh settings "$tmp" >/dev/null; rm -f "$tmp"
  A shell input keyevent KEYCODE_HOME; sleep 1
  ./tv.sh screensaver test >/dev/null; sleep 9
  A exec-out screencap -p > "$SHOTS/$label.png" && sips -Z 1280 "$SHOTS/$label.png" --out "$SHOTS/$label-s.png" >/dev/null
  A shell input keyevent KEYCODE_DPAD_DOWN; sleep 1.5
  echo "$label: $when (shift $shift_min min)"
done
./tv.sh settings clear >/dev/null
echo "SAVER TEST DONE"
