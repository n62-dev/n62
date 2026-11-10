#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# dc hunter's reruns (night review 2026-11-09): read-only, git grep and shell only, no node, no python.
#   bash dc-scan.sh [worktree]     default: the review worktree
#   prints: 1 exported names no other file uses, 2 CSS tokens defined but never read, 3 identical helpers,
#           4 golden case counts against tests/golden/README.md, 5 reports past their week.
W="${1:-$(git rev-parse --show-toplevel)}"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT

git -C "$W" grep -Io -E '[A-Za-z_$][A-Za-z0-9_$]*' -- app tools tests/core tests/engine spec engine/giac/wasm | LC_ALL=C sort -u > "$T/tok"
git -C "$W" grep -InE '^export (default )?(async )?(function\*?|const|let|var|class|type|interface|enum) +[A-Za-z_$]' -- 'app/src/*.ts' 'app/src/*.svelte' ':!*.test.ts' |
  awk -F: '{s=$0; sub(/^[^:]*:[^:]*:/,"",s); k=s; sub(/^export (default )?(async )?/,"",k); split(k,w," "); n=s; sub(/^export (default )?(async )?(function\*?|const|let|var|class|type|interface|enum) +/,"",n); match(n,/^[A-Za-z_$][A-Za-z0-9_$]*/); print substr(n,1,RLENGTH), w[1], $1":"$2}' > "$T/exp"
echo "== 1. exported names no other file mentions (name kind file:line); count by kind"
awk 'NR==FNR{i=index($0,":"); f=substr($0,1,i-1); t=substr($0,i+1); u[t]=u[t] " " f; next}
     {split($3,l,":"); o=0; m=split(u[$1],a," "); for(i=1;i<=m;i++) if(a[i]!=l[1]) o++; if(o==0) print}' "$T/tok" "$T/exp" > "$T/priv"
awk '{print $2}' "$T/priv" | sort | uniq -c
awk '$2!="type" && $2!="interface"' "$T/priv"

echo; echo "== 2. CSS custom properties defined, no var() anywhere under app/ (the MathLive ones are expected)"
git -C "$W" grep -hoIE -e '--[a-zA-Z][a-zA-Z0-9_-]*[[:space:]]*:' -- 'app/src/*.css' 'app/src/*.svelte' 'app/index.html' | sed -E 's/[[:space:]]*:$//' | sort -u > "$T/def"
git -C "$W" grep -hoIE -e 'var\(--[a-zA-Z][a-zA-Z0-9_-]*' -e 'Property\("--[a-zA-Z0-9_-]+' -- app/src app/index.html app/scripts | sed -E 's/.*(--[a-zA-Z0-9_-]+)$/\1/' | sort -u > "$T/use"
comm -23 "$T/def" "$T/use"

echo; echo "== 3. identical helpers"
for p in 'const isObject = ' 'const isCount = ' 'depthAt = '; do git -C "$W" grep -nF -- "$p" -- app/src ':!*.test.ts' | cut -c1-150; done

echo; echo "== 4. golden counts (actual, then the README row)"
for f in home precision solve function bench units parser; do
  echo "$f: $(grep -cE '^\s*-\s*\{?\s*id:' "$W/tests/golden/$f.yaml") | $(grep -E "^\| \`$f\.yaml\`" "$W/tests/golden/README.md" | cut -d'|' -f3)"
done

echo; echo "== 5. reports in docs/shifts last committed more than 7 days before the worktree's HEAD"
now="$(git -C "$W" log -1 --format=%ct)"
git -C "$W" ls-files 'docs/shifts/*-report.md' 'docs/shifts/*-report-[0-9].md' | while read -r f; do
  ct="$(git -C "$W" log -1 --format=%ct -- "$f")"
  [ $((now - ct)) -gt $((7 * 86400)) ] && echo "$f $(git -C "$W" log -1 --format='%h %cs' -- "$f")"
done
true
