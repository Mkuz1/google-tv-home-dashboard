#!/bin/bash
# Builds out/homedash.apk from app/ using the Android SDK command-line tools (no Gradle).
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

OUT=out; B=$OUT/build
rm -rf "$B"; mkdir -p "$B"/{res,gen,classes,dex}

"$BT/aapt2" compile --dir app/res -o "$B/res/res.zip"
"$BT/aapt2" link -o "$B/unsigned.apk" -I "$JAR" \
  --manifest app/AndroidManifest.xml -A app/assets --java "$B/gen" \
  --min-sdk-version 28 --target-sdk-version 34 "$B/res/res.zip"

javac -source 8 -target 8 -bootclasspath "$JAR" -Xlint:-options -encoding UTF-8 \
  -d "$B/classes" $(find app/src "$B/gen" -name '*.java')
"$BT/d8" --release --min-api 28 --lib "$JAR" --output "$B/dex" $(find "$B/classes" -name '*.class')

cp "$B/unsigned.apk" "$B/with-dex.apk"
(cd "$B/dex" && zip -qj ../with-dex.apk classes.dex)
"$BT/zipalign" -f -p 4 "$B/with-dex.apk" "$B/aligned.apk"

KS="${KEYSTORE_FILE:-keystore/homedash.jks}"
PASS="${KEYSTORE_PASSWORD:-homedash}"
ALIAS="${KEYSTORE_ALIAS:-homedash}"
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -storepass "$PASS" -keypass "$PASS" -alias "$ALIAS" \
    -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Home Dashboard" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass "pass:$PASS" --key-pass "pass:$PASS" --ks-key-alias "$ALIAS" \
  --out "$OUT/homedash.apk" "$B/aligned.apk"
echo "Built $OUT/homedash.apk ($(du -h "$OUT/homedash.apk" | cut -f1))"
