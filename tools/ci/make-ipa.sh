#!/bin/bash
# Builds an unsigned IPA. xtool or Sideloadly sign it with the real Apple account when installing.
set -euo pipefail

output_dir="${1:-build/ipa}"
mkdir -p "$output_dir"
archive="$output_dir/DatenbankenLernApp.xcarchive"
xcodebuild archive -project DatenbankenLernApp.xcodeproj -scheme DatenbankenLernApp \
    -configuration Release -destination 'generic/platform=iOS' \
    -archivePath "$archive" CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO

stage="$(mktemp -d "${TMPDIR:-/tmp}/datenbanken-ipa.XXXXXX")"
trap 'rm -rf "$stage"' EXIT
mkdir -p "$stage/Payload"
ditto "$archive/Products/Applications/DatenbankenLernApp.app" "$stage/Payload/DatenbankenLernApp.app"
codesign --force --sign - "$stage/Payload/DatenbankenLernApp.app"
codesign --verify --deep --strict "$stage/Payload/DatenbankenLernApp.app"
ditto -c -k --keepParent "$stage/Payload" "$output_dir/DatenbankenLernApp.ipa"
ls -lh "$output_dir/DatenbankenLernApp.ipa"
