#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# sandra 2026-11-17: which tag does the layout lock test read as "the last release"? layoutLock.ts releaseLock() lists
# `git tag --list v* --sort=-v:refname` and takes the first that holds the lock. A pre-release tag sorts ABOVE its release.
# Usage: bash probe-tagsort.sh   (a throwaway repo in a temp dir; prints the order)
set -euo pipefail
d=$(mktemp -d)
trap 'rm -rf "$d"' EXIT
cd "$d"
git init -q
git -c user.email=probe@example.invalid -c user.name=probe commit -q --allow-empty -m x
git tag v0.1.0-beta.1
git tag v0.1.0
echo "newest first, as releaseLock() reads them:"
git tag --list 'v*' --sort=-v:refname
echo "with versionsort.suffix=- (pre-releases before their release):"
git -c versionsort.suffix=- tag --list 'v*' --sort=-v:refname
