#!/usr/bin/env python3
import json
import re
import subprocess

payload = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', '--json', 'devices', 'available']))
candidates = []
for runtime, devices in payload['devices'].items():
    match = re.search(r'iOS-(\d+)-(\d+)', runtime)
    if not match or int(match[1]) < 26:
        continue
    for device in devices:
        if device.get('isAvailable') and 'iPhone' in device['name']:
            candidates.append(((int(match[1]), int(match[2])), 'Pro' in device['name'], device['name'], device['udid']))
if not candidates:
    raise SystemExit('Kein verfügbarer iPhone-Simulator mit iOS >= 26 gefunden.')
print(max(candidates)[-1])
