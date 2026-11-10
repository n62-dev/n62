# SPDX-License-Identifier: GPL-3.0-or-later
# vca (verifier of ca-7): strongly connected sets over value imports of app/src (tests left out), own walk.
import os, re, sys

root = sys.argv[1]
src = os.path.join(root, 'app/src')
imp = re.compile(r'^\s*(import|export)\s+([^;"\']*?)\s*from\s+["\'](\.[^"\']+)["\']', re.M)
bare = re.compile(r'^\s*import\s+["\'](\.[^"\']+)["\']', re.M)


def value(c):
    c = c.strip()
    if c.startswith('type '):
        return False
    m = re.search(r'\{(.*)\}', c, re.S)
    if m and not c.split('{')[0].strip():
        n = [x.strip() for x in m.group(1).split(',') if x.strip()]
        if n and all(x.startswith('type ') for x in n):
            return False
    return True


files = []
for d, ds, fs in os.walk(src):
    ds[:] = [x for x in ds if x != '_gen']
    for f in fs:
        if f.endswith(('.ts', '.svelte')) and '.test.' not in f and not f.endswith('.d.ts'):
            files.append(os.path.join(d, f))
known = set(files)
g = {}
for f in files:
    t = open(f, encoding='utf8').read()
    if f.endswith('.svelte'):
        t = '\n'.join(re.findall(r'<script[^>]*>(.*?)</script>', t, re.S))
    out = []
    specs = [m.group(3) for m in imp.finditer(t) if value(m.group(2))] + bare.findall(t)
    for s in specs:
        p = os.path.normpath(os.path.join(os.path.dirname(f), s))
        for c in (p, p + '.ts'):
            if c in known:
                out.append(c)
                break
    g[f] = out

sys.setrecursionlimit(10000)
index, low, on, st, res, n = {}, {}, set(), [], [], [0]


def sc(v):
    index[v] = low[v] = n[0]
    n[0] += 1
    st.append(v)
    on.add(v)
    for w in g[v]:
        if w not in index:
            sc(w)
            low[v] = min(low[v], low[w])
        elif w in on:
            low[v] = min(low[v], index[w])
    if low[v] == index[v]:
        c = []
        while True:
            w = st.pop()
            on.discard(w)
            c.append(w)
            if w == v:
                break
        if len(c) > 1:
            res.append(c)


for v in g:
    if v not in index:
        sc(v)
print('files', len(g), 'cycles', len(res))
for c in res:
    print(sorted(os.path.relpath(x, src) for x in c))
