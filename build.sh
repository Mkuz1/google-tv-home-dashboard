#!/bin/bash
# Builds the APKs from app/ using the Android SDK command-line tools (no Gradle):
#   ./build.sh          both: out/mk-tv-launcher.apk and out/mk-car-launcher.apk
#   ./build.sh tv       Google TV / Android TV only (app/AndroidManifest.xml)
#   ./build.sh car      car head unit only (car/AndroidManifest.xml); same code and pages,
#                       the app picks the car home screen from the manifest's "flavor".
# Needs JDK 17+ and an Android SDK with build-tools and a platform (tools/setup-sdk.sh installs both).
#
# Signing: a local keystore is created in keystore/ on first build. To sign with your own,
# set KEYSTORE_FILE, KEYSTORE_PASSWORD and KEYSTORE_ALIAS.
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
for c in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
  [ -n "$SDK" ] && break
  [ -d "$c" ] && SDK="$c"
done
[ -d "${SDK:-}" ] || { echo "Android SDK not found. Run tools/setup-sdk.sh or set ANDROID_HOME." >&2; exit 1; }
BT="$(ls -d "$SDK"/build-tools/* 2>/dev/null | sort -V | tail -1)"
JAR="$(ls -d "$SDK"/platforms/android-*/android.jar 2>/dev/null | sort -V | tail -1)"
[ -x "$BT/aapt2" ] && [ -f "$JAR" ] || { echo "Missing build-tools or platform in $SDK. Run tools/setup-sdk.sh." >&2; exit 1; }

if [ -z "${JAVA_HOME:-}" ]; then
  JAVA_HOME="$(ls -d "$HOME"/Library/Java/JavaVirtualMachines/jdk-*/Contents/Home 2>/dev/null | sort -V | tail -1 || true)"
fi
[ -n "${JAVA_HOME:-}" ] && export JAVA_HOME && export PATH="$JAVA_HOME/bin:$PATH"
command -v javac >/dev/null || { echo "JDK not found. Run tools/setup-sdk.sh or set JAVA_HOME." >&2; exit 1; }

OUT=out
KS="${KEYSTORE_FILE:-keystore/homedash.jks}"
PASS="${KEYSTORE_PASSWORD:-homedash}"
ALIAS="${KEYSTORE_ALIAS:-homedash}"
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=MK TV and Car Launcher" >/dev/null 2>&1
fi

# build <flavor> <manifest> <min-sdk> <apk name>
build() {
  local B=$OUT/build-$1 APK=$OUT/$4
  rm -rf "$B"; mkdir -p "$B"/{res,gen,classes,dex}

  "$BT/aapt2" compile --dir app/res -o "$B/res/res.zip"
  "$BT/aapt2" link -o "$B/unsigned.apk" -I "$JAR" \
    --manifest "$2" -A app/assets --java "$B/gen" \
    --min-sdk-version "$3" --target-sdk-version 34 "$B/res/res.zip"

  javac -source 8 -target 8 -bootclasspath "$JAR" -Xlint:-options -encoding UTF-8 \
    -d "$B/classes" $(find app/src "$B/gen" -name '*.java')
  "$BT/d8" --release --min-api "$3" --lib "$JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')

  cp "$B/unsigned.apk" "$B/with-dex.apk"
  (cd "$B/dex" && zip -qj ../with-dex.apk classes.dex)
  "$BT/zipalign" -f -p 4 "$B/with-dex.apk" "$B/aligned.apk"
  "$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" --ks-key-alias "$ALIAS" \
    --out "$APK" "$B/aligned.apk"
  echo "Built $APK ($(du -h "$APK" | cut -f1))"
}

mkdir -p "$OUT"
case "${1:-all}" in
  tv)  build tv app/AndroidManifest.xml 28 mk-tv-launcher.apk ;;
  car) build car car/AndroidManifest.xml 26 mk-car-launcher.apk ;;
  all) build tv app/AndroidManifest.xml 28 mk-tv-launcher.apk
       build car car/AndroidManifest.xml 26 mk-car-launcher.apk ;;
  *)   echo "usage: ./build.sh [tv|car|all]" >&2; exit 1 ;;
esac
