#!/bin/bash
# Exercise folders on the TV: create, add, open, rename, remove. Screenshots go to $1.
set -uo pipefail
SHOTS="${1:?usage: folder_test.sh <shots-dir>}"; mkdir -p "$SHOTS"
ADB="$HOME/Library/Android/sdk/platform-tools/adb"
IP=$(cat "$(dirname "$0")/../.tv-ip"); A() { "$ADB" -s "$IP:5555" "$@"; }
k() { A shell input keyevent "$@"; sleep 0.6; }
hold() { A shell input keyevent --longpress KEYCODE_DPAD_CENTER; sleep 1.0; }
shot() { A exec-out screencap -p > "$SHOTS/$1.png" && sips -Z 960 "$SHOTS/$1.png" --out "$SHOTS/$1-s.png" >/dev/null; }

A shell am force-stop com.mk.homedash; A shell input keyevent KEYCODE_HOME; sleep 6
# Row 2: AppDrawer, Aptoide, BRAVIA notifications, BrowseHere, Eco Dashboard
k KEYCODE_DPAD_DOWN; k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_RIGHT          # BRAVIA notifications
hold; shot f1-menu                                                       # Move · Add to Folder · Hide
k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_CENTER; shot f2-choices             # New Folder
k KEYCODE_DPAD_CENTER; sleep 0.6; shot f3-created                        # folder tile in place
k KEYCODE_DPAD_RIGHT; hold; k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_CENTER  # BrowseHere > Add to Folder
k KEYCODE_DPAD_RIGHT; shot f4-existing; k KEYCODE_DPAD_CENTER            # pick the existing folder
sleep 0.6; shot f5-two-apps
k KEYCODE_DPAD_CENTER; sleep 0.8; shot f6-open                           # open the folder
hold; shot f7-inside-menu; k KEYCODE_BACK                                # Move · Move Out · Hide
k KEYCODE_BACK; sleep 0.6                                                # close folder
hold; shot f8-folder-menu                                                # Rename · Move · Remove Folder
k KEYCODE_DPAD_CENTER; sleep 1.2; shot f9-rename                         # keyboard up
A shell input text "Sony%sApps"; sleep 0.5; k KEYCODE_ENTER; sleep 1.0; shot f10-renamed
k KEYCODE_BACK; sleep 0.4
hold; k KEYCODE_DPAD_RIGHT; k KEYCODE_DPAD_RIGHT; shot f11-remove; k KEYCODE_DPAD_CENTER   # Remove Folder
sleep 0.8; shot f12-restored
echo "FOLDER TEST DONE"
