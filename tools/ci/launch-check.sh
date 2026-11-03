#!/bin/bash
# Starts the built app in the simulator: it must still be running after a few seconds, also when
# the content has to be loaded. Screenshots in light and dark mode go to build/screenshots.
set -euo pipefail

simulator="${1:?Simulator UUID fehlt}"
app_path="${2:?Pfad zur Simulator-App fehlt}"
output_dir="build/screenshots"
bundle_id=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$app_path/Info.plist")
mkdir -p "$output_dir"
xcrun simctl bootstatus "$simulator" -b
xcrun simctl install "$simulator" "$app_path"

for appearance in light dark; do
    xcrun simctl ui "$simulator" appearance "$appearance"
    xcrun simctl launch --terminate-running-process "$simulator" "$bundle_id" -AppleLanguages '(de)' -AppleLocale de_DE
    sleep 8
    if ! xcrun simctl spawn "$simulator" launchctl list | grep -q "$bundle_id"; then
        echo "::error::Die App läuft nach dem Start nicht mehr ($appearance)."
        exit 1
    fi
    xcrun simctl io "$simulator" screenshot "$output_dir/start-$appearance.png"
done
echo "App startet und läuft."
