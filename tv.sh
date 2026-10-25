#!/bin/bash
# Talk to a Google TV / Android TV over Wi-Fi with adb.
#   ./tv.sh connect <tv-ip> [port]      Connect (default port 5555) and remember the TV; accept the prompt on the TV
#   ./tv.sh pair <tv-ip> <port> <code>  Pair first if the TV uses "Wireless debugging" with a pairing code
#   ./tv.sh install [file.apk]          Install / update the app (default: out/homedash.apk, built if missing)
#   ./tv.sh set-home                    Make it the Home screen (turns off the stock home screen)
#   ./tv.sh restore                     Bring back the stock home screen and screensaver
#   ./tv.sh screensaver [on|off|test]   Use it as the screensaver (off = the TV's default screensaver)
#   ./tv.sh delay <minutes>             Start the screensaver after this many idle minutes
#   ./tv.sh settings <file.json|show|clear>  Per-TV settings (city, prayer method, logo...; see settings.example.json)
#   ./tv.sh albums [list|add <link>|remove <link>|clear]  Shared Google Photos albums for the screensaver
#   ./tv.sh photos <folder>             Replace the pushed screensaver photos with the images in <folder>
#   ./tv.sh apps                        List installed TV apps (package names for homeOrder / homeExclude)
set -euo pipefail
cd "$(dirname "$0")"

# adb: from PATH, $ANDROID_HOME, or the usual SDK locations on macOS / Linux.
ADB="${ADB:-$(command -v adb || true)}"
for c in "${ANDROID_HOME:-}/platform-tools/adb" "$HOME/Library/Android/sdk/platform-tools/adb" "$HOME/Android/Sdk/platform-tools/adb"; do
  [ -n "$ADB" ] && break
  [ -x "$c" ] && ADB="$c"
done
[ -n "$ADB" ] || { echo "adb not found. Install Android platform-tools (see README)." >&2; exit 1; }

PKG=com.mk.homedash
FILES=/sdcard/Android/data/$PKG/files
PHOTO_DIR=$FILES/photos
# Stock home screens and their setup fallbacks, on Google TV and older Android TV.
STOCK_HOME=(com.google.android.apps.tv.launcherx com.google.android.tungsten.setupwraith com.google.android.tvlauncher com.google.android.leanbacklauncher)
DEFAULT_SAVER=com.google.android.apps.tv.dreamx/.service.Backdrop

TV_IP="${TV_IP:-$(cat .tv-ip 2>/dev/null || true)}"

target() {
  [ -n "$TV_IP" ] || { echo "No TV yet. Run: ./tv.sh connect <tv-ip>" >&2; exit 1; }
  local dev
  dev=$("$ADB" devices | awk -v ip="$TV_IP" 'index($1, ip ":") == 1 && $2 == "device" {print $1; exit}')
  [ -n "$dev" ] || { echo "Not connected to $TV_IP. Run: ./tv.sh connect $TV_IP" >&2; exit 1; }
  echo "$dev"
}
sh_tv() { "$ADB" -s "$(target)" shell "$@"; }
push() { sh_tv mkdir -p "$(dirname "$2")"; "$ADB" -s "$(target)" push "$1" "$2" >/dev/null; }
installed() { sh_tv pm list packages "$1" | grep -qx "package:$1"; }

case "${1:-}" in
  connect)
    TV_IP="${2:?usage: ./tv.sh connect <tv-ip> [port]}"
    echo "$TV_IP" > .tv-ip
    "$ADB" connect "$TV_IP:${3:-5555}"
    "$ADB" devices -l ;;
  pair)
    TV_IP="${2:?usage: ./tv.sh pair <tv-ip> <port> <code>}"
    echo "$TV_IP" > .tv-ip
    "$ADB" pair "$TV_IP:${3:?missing port}" "${4:?missing code}"
    echo "Paired. Now run: ./tv.sh connect $TV_IP <port shown under Wireless debugging>" ;;
  install)
    APK="${2:-out/homedash.apk}"
    [ -f "$APK" ] || ./build.sh
    "$ADB" -s "$(target)" install -r "$APK"
    sh_tv mkdir -p "$PHOTO_DIR" ;;
  set-home)
    sh_tv cmd package set-home-activity "$PKG/.MainActivity" || true
    for p in "${STOCK_HOME[@]}"; do installed "$p" && sh_tv pm disable-user --user 0 "$p" || true; done
    sh_tv input keyevent KEYCODE_HOME
    echo "This is now the Home screen. Undo with: ./tv.sh restore" ;;
  restore)
    for p in "${STOCK_HOME[@]}"; do installed "$p" && sh_tv pm enable "$p" >/dev/null || true; done
    sh_tv settings put secure screensaver_components "$DEFAULT_SAVER" || true
    sh_tv input keyevent KEYCODE_HOME
    echo "Stock home screen and screensaver restored. To remove the app too: adb uninstall $PKG" ;;
  screensaver)
    case "${2:-on}" in
      on)   sh_tv settings put secure screensaver_components "$PKG/.DashboardDream"
            sh_tv settings put secure screensaver_enabled 1
            echo "Screensaver set." ;;
      off)  sh_tv settings put secure screensaver_components "$DEFAULT_SAVER"
            echo "Screensaver set back to the TV's default." ;;
      test) sh_tv am start -n com.android.systemui/.Somnambulator ;;
      *)    echo "usage: ./tv.sh screensaver [on|off|test]"; exit 1 ;;
    esac ;;
  delay)
    mins="${2:?usage: ./tv.sh delay <minutes>}"
    sh_tv settings put system screen_off_timeout $((mins * 60000))
    echo "Screensaver starts after $mins idle minute(s)." ;;
  settings)
    F="$FILES/settings.json"
    case "${2:?usage: ./tv.sh settings <file.json|show|clear>}" in
      show)  sh_tv "cat '$F' 2>/dev/null" || echo "(no settings.json on the TV; defaults in use)" ;;
      clear) sh_tv rm -f "$F"; echo "Settings cleared; defaults in use." ;;
      *)     python3 -c 'import json,sys; json.load(open(sys.argv[1]))' "$2" || { echo "$2 is not valid JSON" >&2; exit 1; }
             push "$2" "$F"
             echo "Settings sent. They apply the next time Home or the screensaver opens." ;;
    esac ;;
  albums)
    F="$FILES/albums.json"
    current=$(sh_tv "cat '$F' 2>/dev/null" || true)
    case "${2:-list}" in
      add)    new=$(python3 -c 'import json,sys; l=json.loads(sys.argv[1] or "[]"); u=sys.argv[2].strip(); l+=[u] if u not in l else []; print(json.dumps(l))' "$current" "${3:?usage: ./tv.sh albums add <share link>}") ;;
      remove) new=$(python3 -c 'import json,sys; l=json.loads(sys.argv[1] or "[]"); print(json.dumps([u for u in l if u!=sys.argv[2].strip()]))' "$current" "${3:?usage: ./tv.sh albums remove <share link>}") ;;
      clear)  new="[]" ;;
      list)   python3 -c 'import json,sys; [print(u) for u in json.loads(sys.argv[1] or "[]")]' "$current"; exit 0 ;;
      *)      echo "usage: ./tv.sh albums [list|add <link>|remove <link>|clear]"; exit 1 ;;
    esac
    tmp=$(mktemp); printf '%s' "$new" > "$tmp"
    push "$tmp" "$F"; rm -f "$tmp"
    python3 -c 'import json,sys; l=json.loads(sys.argv[1]); print(f"{len(l)} album(s) set. The screensaver loads them the next time it starts.")' "$new" ;;
  photos)
    SRC="${2:?usage: ./tv.sh photos <folder>}"
    sh_tv "rm -rf '$PHOTO_DIR' && mkdir -p '$PHOTO_DIR'"
    n=0
    while IFS= read -r -d '' f; do
      "$ADB" -s "$(target)" push "$f" "$PHOTO_DIR/" >/dev/null && n=$((n+1))
    done < <(find "$SRC" -maxdepth 1 -type f \( -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.png' -o -iname '*.webp' \) -print0)
    echo "Pushed $n photos. They appear the next time the screensaver starts." ;;
  apps)
    sh_tv cmd package query-activities -a android.intent.action.MAIN -c android.intent.category.LEANBACK_LAUNCHER \
      | awk -F= '/packageName=/{print $2}' | sort -u ;;
  *)
    sed -n '2,14p' "$0"; exit 1 ;;
esac
