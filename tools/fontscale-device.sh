#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# R703: the font-scale check (app/test-device/fontscale.device.ts) on a WebView over adb, at font_scale 1.3 (the control),
# 1.5 and 2.0. Needs the test build installed (tools/device-build.sh --test --install).
#   ANDROID_SERIAL=emulator-5554 tools/fontscale-device.sh [--scales 1.5,2.0]
# It sets `settings put system font_scale`, which the device rules (docs/shifts/rules.md section 3) allow on an emulator only;
# a real device needs the owner's word, given as FONTSCALE_DEVICE_OK=1. The old value is put back on every exit.
# Prints one `FONTSCALE <scale>: …` line per scale (the zoom, the smallest size drawn, the ellipsed texts per screen); exit 0 when all pass.
set -uo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERIAL="${ANDROID_SERIAL:?set ANDROID_SERIAL to the emulator}"
SCALES="1.3,1.5,2.0"
while (( $# )); do case "$1" in --scales) SCALES="$2"; shift 2 ;; *) echo "unknown option $1" >&2; exit 2 ;; esac; done
if [[ "$SERIAL" != emulator-* && "${FONTSCALE_DEVICE_OK:-}" != 1 ]]; then
  echo "$SERIAL is not an emulator: changing its font scale needs the owner's word (FONTSCALE_DEVICE_OK=1)" >&2; exit 2
fi
OWNER="fontscale-device-$$"
"$REPO/tools/devlock.sh" acquire "$SERIAL" "$OWNER" 900 || { echo "device $SERIAL busy" >&2; exit 3; }
BEFORE="$(adb -s "$SERIAL" shell settings get system font_scale 2>/dev/null | tr -d '\r')"
cleanup() {
  [[ "$BEFORE" =~ ^[0-9.]+$ ]] || BEFORE=1.0
  adb -s "$SERIAL" shell settings put system font_scale "$BEFORE" >&2 || true
  "$REPO/tools/stay-awake.sh" "$SERIAL" --restore >&2 || true
  "$REPO/tools/devlock.sh" release "$SERIAL" "$OWNER" >&2 || true
}
trap cleanup EXIT
"$REPO/tools/stay-awake.sh" "$SERIAL" >&2 || exit 4
[[ -x "$REPO/app/node_modules/.bin/playwright" ]] || { echo "no Playwright in $REPO/app/node_modules: npm ci there first" >&2; exit 5; }
cd "$REPO/app" && FONT_SCALES="$SCALES" timeout 1200 npx --no-install playwright test -c playwright.fontscale.config.ts
