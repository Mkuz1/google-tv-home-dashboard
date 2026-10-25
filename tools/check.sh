#!/bin/bash
# Build, install and screenshot the home screen and screensaver on the TV.
# Screenshots land in $1 (default ./out/shots).
set -uo pipefail
cd "$(dirname "$0")/.."
SHOTS="${1:-out/shots}"; mkdir -p "$SHOTS"
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
IP=$(cat "$(dirname "$0")/../.tv-ip"); A() { "$ADB" -s "$IP:5555" "$@"; }
shot() { A exec-out screencap -p > "$SHOTS/$1.png" && sips -Z 960 "$SHOTS/$1.png" --out "$SHOTS/$1-s.png" >/dev/null; }
cpu() { for i in 1 2 3 4; do A shell top -b -n 1 | grep -E "com.mk.homedash|sandboxed_process" | awk '{printf "%s%% ", $9} END{print ""}'; sleep 2; done; }

for f in home.js screensaver.js bridge-mock.js config.js; do
  node -e "new Function(require('fs').readFileSync('app/assets/$f','utf8'))" || { echo "SYNTAX ERROR in $f"; exit 1; }
done
bash -n tv.sh || { echo "SYNTAX ERROR in tv.sh"; exit 1; }
./build.sh 2>&1 | grep -v "^Note" | tail -3 || exit 1
"$ADB" connect "$IP:5555" | tail -1
A install -r out/homedash.apk | tail -1
A logcat -c

echo "== home"
A shell am force-stop com.mk.homedash
A shell input keyevent KEYCODE_HOME; sleep 6; shot home
A shell input keyevent KEYCODE_DPAD_RIGHT; sleep 1; shot home-netflix
A shell input keyevent --longpress KEYCODE_DPAD_CENTER; sleep 1.2; shot popover
A shell input keyevent KEYCODE_DPAD_CENTER; sleep 0.8; shot moving
A shell input keyevent KEYCODE_BACK; sleep 0.8
A shell input keyevent KEYCODE_DPAD_DOWN; sleep 1; shot scrolled
A shell input keyevent KEYCODE_DPAD_UP; sleep 0.5; A shell input keyevent KEYCODE_DPAD_UP; sleep 1; shot topbar
A shell input keyevent KEYCODE_DPAD_DOWN; sleep 0.5; A shell input keyevent KEYCODE_DPAD_LEFT; sleep 3
echo "home cpu:"; cpu

echo "== screensaver"
A shell am start -n com.android.systemui/.Somnambulator >/dev/null; sleep 12; shot screensaver
echo "screensaver cpu:"; cpu
A shell input keyevent KEYCODE_DPAD_DOWN; sleep 2
echo "== log"; A logcat -d -s HomeDash | tail -8
echo "CHECK DONE"
