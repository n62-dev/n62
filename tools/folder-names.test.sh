#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# A65: the sync folder's name rule (android/.../FolderNames.java) with javac alone: the app's Gradle build has no
# unit-test setup, and the rule is plain Java. The names come from tests/fixtures/folder-names.json, the same list
# app/src/clipboard/folder.test.ts checks the TypeScript copy with, so the two copies cannot drift apart. Run on every
# merge by app/scripts/folder-names.test.ts (Vitest). Prints "folder-names: N passed" or the failing name; exit 0 or 1
# (also 1, with a message, when javac, java or node is missing: the check fails, it never skips).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURE="$ROOT/tests/fixtures/folder-names.json"
for tool in javac java node; do
  command -v "$tool" >/dev/null || { echo "folder-names: FAILED, $tool not found (needs a JDK and node)"; exit 1; }
done
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/src/dev/n62/calc"
cp "$ROOT/android/app/src/main/java/dev/n62/calc/FolderNames.java" "$TMP/src/dev/n62/calc/"
# One line per name: "accept|refuse <UTF-8 hex>", or "refuse null" for Java's null (hex keeps NUL and backslash intact).
node -e '
  const f = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  const expand = (e) => (e !== null && typeof e === "object" ? e.repeat.repeat(e.times) : e);
  for (const kind of ["accept", "refuse"])
    for (const e of f[kind]) {
      const s = expand(e);
      console.log(kind + " " + (s === null ? "null" : "x" + Buffer.from(s, "utf8").toString("hex")));
    }
' "$FIXTURE" > "$TMP/names.txt"
cat > "$TMP/src/dev/n62/calc/FolderNamesCheck.java" <<'JAVA'
package dev.n62.calc;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HexFormat;

public class FolderNamesCheck {
    public static void main(String[] a) throws Exception {
        int n = 0;
        for (String line : Files.readAllLines(Path.of(a[0]), StandardCharsets.UTF_8)) {
            String[] p = line.split(" ", 2);
            String name = p[1].equals("null") ? null : new String(HexFormat.of().parseHex(p[1].substring(1)), StandardCharsets.UTF_8);
            boolean want = p[0].equals("accept");
            if (FolderNames.valid(name) != want) fail((want ? "refused " : "accepted ") + (name == null ? "null" : name));
            n++;
        }
        if (n == 0) fail("no names in the fixture");
        System.out.println("folder-names: " + n + " passed");
    }
    static void fail(String m) { System.out.println("folder-names: FAILED, " + m); System.exit(1); }
}
JAVA
javac -d "$TMP/out" "$TMP/src/dev/n62/calc/"*.java
java -cp "$TMP/out" dev.n62.calc.FolderNamesCheck "$TMP/names.txt"
