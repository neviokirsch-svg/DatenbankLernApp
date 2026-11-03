#!/bin/bash
set -euo pipefail

# Runner images change over time. Pick the newest installed stable Xcode >= 26.
developer_dir="$(python3 - <<'PY'
import glob
import plistlib
import re
from pathlib import Path

candidates = []
for app in glob.glob('/Applications/Xcode*.app'):
    if 'beta' in app.lower() or 'release_candidate' in app.lower():
        continue
    with open(Path(app) / 'Contents/Info.plist', 'rb') as file:
        version = plistlib.load(file).get('CFBundleShortVersionString', '')
    if not re.fullmatch(r'\d+(?:\.\d+)*', version):
        continue
    parts = tuple(map(int, version.split('.')))
    if parts[0] >= 26:
        candidates.append((parts, str(Path(app) / 'Contents/Developer')))
if not candidates:
    raise SystemExit('Kein stabiles Xcode ab Version 26 auf diesem Runner gefunden.')
print(max(candidates)[1])
PY
)"
echo "DEVELOPER_DIR=$developer_dir" >> "$GITHUB_ENV"
DEVELOPER_DIR="$developer_dir" xcodebuild -version
