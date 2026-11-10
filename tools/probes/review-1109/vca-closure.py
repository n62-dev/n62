# SPDX-License-Identifier: GPL-3.0-or-later
# vca (verifier of ca): own import walk over value imports, independent of ca-graph.mjs.
# usage: vca-closure.py <worktree> <entry file relative to the worktree> [--dynamic]
import os, re, sys, subprocess

root = sys.argv[1]
entry = sys.argv[2]
dyn = '--dynamic' in sys.argv
imp = re.compile(r'^\s*(import|export)\s+([^;"\']*?)\s*from\s+["\'](\.[^"\']+)["\']', re.M)
bare = re.compile(r'^\s*import\s+["\'](\.[^"\']+)["\']', re.M)
dyn_re = re.compile(r'import\(\s*["\'](\.[^"\']+)["\']\s*\)')


def value(clause):
    c = clause.strip()
    if c.startswith('type '):
        return False
    m = re.search(r'\{(.*)\}', c, re.S)
    if m and not c.split('{')[0].strip():
        names = [n.strip() for n in m.group(1).split(',') if n.strip()]
        if names and all(n.startswith('type ') for n in names):
            return False
    return True


def resolve(base, spec):
    p = os.path.normpath(os.path.join(os.path.dirname(base), spec))
    for cand in (p, p + '.ts', p + '/index.ts'):
        if os.path.isfile(os.path.join(root, cand)):
            return cand
    return None


def script(text, name):
    if name.endswith('.svelte'):
        return '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', text, re.S))
    return text


seen, stack = set(), [entry]
edges = {}
while stack:
    f = stack.pop()
    if f in seen:
        continue
    seen.add(f)
    try:
        text = script(open(os.path.join(root, f), encoding='utf8').read(), f)
    except OSError:
        continue
    deps = []
    for m in imp.finditer(text):
        if value(m.group(2)):
            deps.append(m.group(3))
    deps += bare.findall(text)
    if dyn:
        deps += dyn_re.findall(text)
    for d in deps:
        r = resolve(f, d)
        if r and not r.endswith(('.yaml', '.json', '.css')):
            edges.setdefault(r, set()).add(f)
            stack.append(r)

pat = re.search(r"^GOLDEN_RE='(.*)'$", open(os.path.join(root, 'scripts/pipeline-lib.sh')).read(), re.M).group(1)
rx = re.compile(pat)
print('modules', len(seen))
for f in sorted(seen):
    print(('sel  ' if rx.search(f) else 'MISS ') + f)
print('--- importers of giacPrint inside the walk')
for f in sorted(edges.get('app/src/engine/giacPrint.ts', [])):
    print(f)
