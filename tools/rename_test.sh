#!/bin/bash
# Rename the test folder (row 2, third tile) with a one-click name, then with the keyboard,
# then remove the folder again. Screenshots go to $1.
set -uo pipefail
SHOTS="${1:?usage: rename_test.sh <shots-dir>}"; mkdir -p "$SHOTS"
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
IP=$(cat "$(dirname "$0")/../.tv-ip"); A() { "$ADB" -s "$IP:5555" "$@"; }
k() { A shell input keyevent "$@"; sleep 0.7; }
hold() { A shell input keyevent --longpress KEYCODE_DPAD_CENTER; sleep 1.0; }
shot() { A exec-out screencap -p > "$SHOTS/$1.png" && sips -Z 960 "$SHOTS/$1.png" --out "$SHOTS/$1-s.png" >/dev/null; }

A shell am force-stop com.mk.homedash; A shell input keyevent KEYCODE_HOME; sleep 6
k KEYCODE_DPAD_DOWN; k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_RIGHT
hold; k KEYCODE_DPAD_CENTER; shot n1-ideas                      # Rename > name ideas
k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_CENTER; sleep 0.6; shot n2-picked   # second idea
hold; k KEYCODE_DPAD_CENTER; k KEYCODE_DPAD_CENTER; sleep 1.5; shot n3-dialog   # Rename > Type a Name…
A shell input keyevent KEYCODE_DEL; A shell input text "Kids%sCorner"; sleep 0.8; shot n4-typed
k KEYCODE_ENTER; sleep 1.0; shot n5-renamed
hold; k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_CENTER; sleep 0.8; shot n6-removed
echo "RENAME TEST DONE"
