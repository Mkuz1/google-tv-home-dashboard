#!/bin/bash
# Measure home-screen smoothness: drive the remote through a fixed route and read frame stats.
set -uo pipefail
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
IP=$(cat "$(dirname "$0")/../.tv-ip"); A() { "$ADB" -s "$IP:5555" "$@"; }
k() { A shell input keyevent "$@"; }

A shell input keyevent KEYCODE_HOME; sleep 3
A shell dumpsys gfxinfo com.mk.homedash reset >/dev/null
# Across the top row and back, down through all rows and back up, plus a popover.
for i in 1 2 3 4; do k KEYCODE_DPAD_RIGHT; sleep 0.25; done
for i in 1 2 3 4; do k KEYCODE_DPAD_LEFT; sleep 0.25; done
for i in 1 2 3 4; do k KEYCODE_DPAD_DOWN; sleep 0.35; done
for i in 1 2 3 4; do k KEYCODE_DPAD_UP; sleep 0.35; done
k --longpress KEYCODE_DPAD_CENTER; sleep 0.8
k KEYCODE_DPAD_RIGHT; sleep 0.3; k KEYCODE_BACK; sleep 0.8
A shell dumpsys gfxinfo com.mk.homedash | grep -E "Total frames|Janky frames|50th|90th|95th|99th|Slow UI|Slow bitmap|Slow issue|Frame deadline"
