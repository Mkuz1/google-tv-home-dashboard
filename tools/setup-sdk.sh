#!/bin/bash
# Installs what build.sh and tv.sh need, without Android Studio:
# JDK 17 (Temurin) and the Android SDK pieces (platform-tools, build-tools 35, platform 34).
# macOS (Apple Silicon / Intel) and Linux x64. Re-running is safe.
set -euo pipefail

OS=$(uname -s); ARCH=$(uname -m)
if [ "$OS" = Darwin ]; then
  SDK="${ANDROID_HOME:-$HOME/Library/Android/sdk}"; JDK_ROOT="$HOME/Library/Java/JavaVirtualMachines"
  TOOLS_OS=darwin; BT_OS=macosx; JDK_OS=mac
else
  SDK="${ANDROID_HOME:-$HOME/Android/Sdk}"; JDK_ROOT="$HOME/.local/jdk"
  TOOLS_OS=linux; BT_OS=linux; JDK_OS=linux
fi
[ "$ARCH" = arm64 ] || [ "$ARCH" = aarch64 ] && JDK_ARCH=aarch64 || JDK_ARCH=x64

R=https://dl.google.com/android/repository
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir -p "$SDK/build-tools" "$SDK/platforms" "$JDK_ROOT"

if [ ! -x "$SDK/platform-tools/adb" ]; then
  echo "Downloading platform-tools (adb)..."
  curl -fsSLo "$TMP/pt.zip" "$R/platform-tools-latest-$TOOLS_OS.zip"
  unzip -q "$TMP/pt.zip" -d "$SDK"
fi
if [ ! -d "$SDK/build-tools/35.0.1" ]; then
  echo "Downloading build-tools 35.0.1..."
  curl -fsSLo "$TMP/bt.zip" "$R/build-tools_r35.0.1_$BT_OS.zip"
  unzip -q "$TMP/bt.zip" -d "$TMP/bt" && mv "$TMP"/bt/* "$SDK/build-tools/35.0.1"
fi
if [ ! -d "$SDK/platforms/android-34" ]; then
  echo "Downloading Android 14 platform (API 34)..."
  curl -fsSLo "$TMP/pl.zip" "$R/platform-34-ext12_r01.zip"
  unzip -q "$TMP/pl.zip" -d "$TMP/pl" && mv "$TMP"/pl/* "$SDK/platforms/android-34"
fi
if ! ls -d "$JDK_ROOT"/jdk-17* >/dev/null 2>&1 && ! command -v javac >/dev/null; then
  echo "Downloading JDK 17..."
  URL=$(curl -fsSL "https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=$JDK_ARCH&image_type=jdk&os=$JDK_OS" \
    | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['binary']['package']['link'])")
  curl -fsSLo "$TMP/jdk.tgz" "$URL"
  tar xzf "$TMP/jdk.tgz" -C "$JDK_ROOT"
fi
echo "Done. SDK: $SDK"
[ "$OS" = Darwin ] || echo "On Linux, set JAVA_HOME to the JDK in $JDK_ROOT (or install openjdk-17-jdk) before ./build.sh."
