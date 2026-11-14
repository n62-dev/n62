#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# A145: does F-Droid's engine build (the recipe's `engine/giac/build-wasm.sh` with EMSDK_DIR=system, as a non-root user at another
# path) give the bytes of the release engine (build-wasm-release.sh, `setarch -R`, root, /src)?
#   tools/probes/fdroid-bits.sh release          the release build (build-wasm-release.sh) -> _out/fdroid-bits/release
#   tools/probes/fdroid-bits.sh recipe           as the recipe runs it: user vagrant, /home/vagrant/build/dev.n62.calc, no setarch
#   tools/probes/fdroid-bits.sh setarch          the same under `setarch "$(uname -m)" -R` (container with seccomp=unconfined)
#   tools/probes/fdroid-bits.sh setarch-default  `setarch -R true` alone under the container's default seccomp profile
#   tools/probes/fdroid-bits.sh table            the hashes of the four runs, the objects that differ, the verdict line
# Each build is one piece of at most 10 minutes: run it as `tools/devlock.sh slice <name> tools/probes/fdroid-bits.sh <variant>`.
# The container sees scratch copies only (never the checkout or _downloads/, rules section 3). The image and the emscripten pin are
# read from build-wasm-release.sh, the apt line from the recipe, so the probe follows them. Env: N62_DL_DIR (default: the main
# checkout's engine/giac/_downloads), CONTAINER_ENGINE (podman), JOBS (the recipe sets none: nproc), KEEP_SCRATCH=1; for a recipe or setarch
# build also TAG (a suffix of its result folder, for a repeat or a variation) and BUILD_PATH (the tree's path in the container;
# default /home/vagrant/build/dev.n62.calc), AS_USER (vagrant, or root as the release build runs), APT_LINE (another apt line than the
# recipe's), PAD (an extra environment variable of that many bytes); `table` takes the folders of such runs as further arguments;
# `release` takes TAG too (a repeat). The A145 findings are in fdroid/README.md.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
MAIN="${ROOT%%/.claude/worktrees/*}"
DL="${N62_DL_DIR:-$MAIN/engine/giac/_downloads}"
CE="${CONTAINER_ENGINE:-podman}"
OUTD="$HERE/_out/fdroid-bits"
REL="$ROOT/engine/giac/build-wasm-release.sh"
IMAGE="$(sed -nE 's/^IMAGE="([^"]+)".*/\1/p' "$REL")"
PKG="$(sed -nE 's/^EMSCRIPTEN_PKG_VERSION="([^"]+)".*/\1/p' "$REL")"
APT="$(sed -nE 's/^ *- (apt-get install .*)$/\1/p' "$ROOT/fdroid/dev.n62.calc.yml" | head -1)"
TAG="${TAG:-}"; BUILD_PATH="${BUILD_PATH:-/home/vagrant/build/dev.n62.calc}"
APT="${APT_LINE:-$APT}"
variant="${1:?usage: fdroid-bits.sh release|recipe|setarch|setarch-default|table}"
[[ -n "$IMAGE" && -n "$PKG" ]] || { echo "no IMAGE or EMSCRIPTEN_PKG_VERSION in $REL" >&2; exit 1; }

scratch_rm() { "$CE" unshare rm -rf "$1" 2>/dev/null || rm -rf "$1"; }
objsums() { (cd "$1" && sha256sum ./*.o | sed 's# \./# #') > "$2"; }  # <object dir> <out file>

case "$variant" in
  release)
    [[ -d "$DL" ]] || { echo "no download cache at $DL (set N62_DL_DIR)" >&2; exit 1; }
    mkdir -p "$OUTD/release$TAG"
    log="$OUTD/release$TAG/build.log"
    NO_LOCK=1 KEEP_SCRATCH=1 N62_DL_DIR="$DL" "$REL" > "$log" 2>&1 || { tail -20 "$log" >&2; exit 1; }
    scr="$(sed -nE 's/^scratch kept: //p' "$log" | tail -1)"
    out="$ROOT/engine/giac/_out/release"
    cp "$out/giac.mjs" "$out/giac.wasm" "$OUTD/release$TAG/"
    objsums "$scr/src/engine/giac/_build/giac-obj-gsl" "$OUTD/release$TAG/objs.sha256"
    scratch_rm "$scr"
    (cd "$OUTD/release$TAG" && sha256sum giac.mjs giac.wasm | tee SHA256SUMS)
    ;;
  recipe|setarch)
    [[ -d "$DL" ]] || { echo "no download cache at $DL (set N62_DL_DIR)" >&2; exit 1; }
    [[ -n "$APT" ]] || { echo "no apt-get install line in the recipe" >&2; exit 1; }
    prefix=""; [[ "$variant" != setarch ]] || prefix='setarch "$(uname -m)" -R '
    seccomp=(); [[ "$variant" != setarch ]] || seccomp=(--security-opt seccomp=unconfined)
    SCR="$(mktemp -d "${TMPDIR:-/tmp}/n62-fdroidbits.XXXXXX")"
    trap '[[ "${KEEP_SCRATCH:-0}" == 1 ]] || scratch_rm "$SCR"' EXIT
    mkdir -p "$SCR/src" "$SCR/dl" "$SCR/out" "$OUTD/$variant$TAG"
    (cd "$ROOT" && tar --exclude=engine/giac/_out --exclude=engine/giac/_downloads --exclude=engine/giac/_build -cf - engine/giac) | tar -xf - -C "$SCR/src"
    for f in giac_2.1.0-1.tar.gz giac_2.1.0-1.dsc gmp-6.3.0.tar.xz mpfr-4.2.2.tar.xz gsl-2.8.tar.gz; do cp "$DL/$f" "$SCR/dl/"; done
    # the recipe's engine step, as fdroidserver runs it: `bash -e -u -o pipefail -x -c` in the build's subdir (android/app)
    snippet="cd ../..; export N62_DL_DIR=/tmp/n62-dl; export N62_QALC_DL_DIR=/tmp/n62-qalc-dl; export EMSDK_DIR=system; export EMSCRIPTEN_PKG_VERSION=$PKG; ${JOBS:+export JOBS=$JOBS; }${prefix}engine/giac/build-wasm.sh"
    "$CE" run --rm "${seccomp[@]}" -v "$SCR/src:/srcro:ro,Z" -v "$SCR/dl:/dl:ro,Z" -v "$SCR/out:/out:Z" \
      -e APT="$APT" -e SNIPPET="$snippet" -e B="$BUILD_PATH" -e AS_USER="${AS_USER:-vagrant}" ${PAD:+-e N62_PAD="$(head -c "$PAD" /dev/zero | tr "\\0" x)"} "$IMAGE" bash -euxc '
      export DEBIAN_FRONTEND=noninteractive
      apt-get update -qq
      eval "$APT" >/dev/null
      emcc --version | head -1
      useradd -m -s /bin/bash vagrant
      mkdir -p "$B/android/app" /tmp/n62-dl
      cp -a /srcro/. "$B/"
      cp -a /dl/. /tmp/n62-dl/
      chown -R vagrant:vagrant /home/vagrant /tmp/n62-dl "$B"
      cd "$B/android/app"
      rc=0
      if [ "$AS_USER" = root ]; then bash -e -u -o pipefail -x -c "$SNIPPET" || rc=$?
      else runuser -u "$AS_USER" -- env HOME=/home/"$AS_USER" bash -e -u -o pipefail -x -c "$SNIPPET" || rc=$?; fi
      [ "$rc" = 0 ] || { echo "build failed: $rc" >&2; exit "$rc"; }
      cd "$B/engine/giac"
      cp _out/gsl/giac.mjs _out/gsl/giac.wasm /out/
      (cd _build/giac-obj-gsl && sha256sum ./*.o | sed "s# \./# #") > /out/objs.sha256
    ' 2>&1 | tee "$OUTD/$variant$TAG/build.log" | tail -n 25
    [[ "${PIPESTATUS[0]}" == 0 ]] || { echo "container run failed (log $OUTD/$variant$TAG/build.log)" >&2; exit 1; }
    cp "$SCR/out/giac.mjs" "$SCR/out/giac.wasm" "$SCR/out/objs.sha256" "$OUTD/$variant$TAG/"
    (cd "$OUTD/$variant$TAG" && sha256sum giac.mjs giac.wasm | tee SHA256SUMS)
    ;;
  setarch-default)
    mkdir -p "$OUTD/setarch-default"
    rc=0; msg="$("$CE" run --rm "$IMAGE" bash -c 'setarch "$(uname -m)" -R true' 2>&1)" || rc=$?
    printf '%s\n' "$rc" > "$OUTD/setarch-default/rc"; printf '%s\n' "$msg" > "$OUTD/setarch-default/msg"
    echo "setarch -R true under the default seccomp profile: exit $rc ${msg:+($msg)}"
    ;;
  table)
    printf '%-18s %-66s %s\n' build giac.wasm giac.mjs
    for v in release recipe setarch "${@:2}"; do
      f="$OUTD/$v/SHA256SUMS"
      [[ -f "$f" ]] || { printf '%-18s (not run)\n' "$v"; continue; }
      printf '%-18s %-66s %s\n' "$v" "$(awk '$2=="giac.wasm"{print $1}' "$f")" "$(awk '$2=="giac.mjs"{print $1}' "$f")"
    done
    for v in recipe setarch "${@:2}"; do
      [[ -f "$OUTD/release/objs.sha256" && -f "$OUTD/$v/objs.sha256" ]] || continue
      n="$(diff <(sort "$OUTD/release/objs.sha256") <(sort "$OUTD/$v/objs.sha256") | grep -c '^>' || true)"
      echo "objects of $v that differ from release: $n of $(wc -l < "$OUTD/release/objs.sha256")"
      diff <(sort -k2 "$OUTD/release/objs.sha256") <(sort -k2 "$OUTD/$v/objs.sha256") | sed -n 's/^> [0-9a-f]* *//p' | head -40 | tr '\n' ' ' || true; echo
    done
    same() { [[ -f "$OUTD/$1/SHA256SUMS" && -f "$OUTD/release/SHA256SUMS" ]] && cmp -s "$OUTD/$1/SHA256SUMS" "$OUTD/release/SHA256SUMS"; }
    sd="$(cat "$OUTD/setarch-default/rc" 2>/dev/null || echo '?')"
    echo "setarch -R true under default seccomp: exit $sd"
    if same recipe; then echo "FDROID BITS: match"
    elif same setarch && [[ "$sd" == 0 ]]; then echo "FDROID BITS: match under setarch"
    elif same setarch; then echo "FDROID BITS: differ (matches only under setarch -R, which the default seccomp profile refuses: ASLR)"
    else echo "FDROID BITS: differ (neither the recipe build nor the setarch build matches the release engine)"; fi
    ;;
  *) echo "unknown variant $variant" >&2; exit 2 ;;
esac
