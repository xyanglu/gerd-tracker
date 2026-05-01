#!/bin/bash
set -e

APK="android/app/build/outputs/apk/release/app-release.apk"
IP_FILE=".phone-ip"

if [ -n "$1" ]; then
  PHONE_IP="$1"
  echo "$PHONE_IP" > "$IP_FILE"
elif [ -f "$IP_FILE" ]; then
  PHONE_IP=$(cat "$IP_FILE")
fi

if [ -n "$PHONE_IP" ]; then
  echo "Connecting to $PHONE_IP..."
  adb connect "$PHONE_IP"
fi

if [ ! -f "$APK" ]; then
  echo "No APK found at $APK — run 'npm run build:apk' first."
  exit 1
fi

echo "Installing $APK..."
adb install -r "$APK"
echo "Done."
