#!/usr/bin/env bash
# SPDX-License-Identifier: GPL-3.0-or-later
# A65: the sync folder's name rule (android/.../FolderNames.java) with javac alone: the app's Gradle build has no
# unit-test setup, and the rule is plain Java. Prints "folder-names: N passed" or the failing name; exit 0 or 1.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/src/dev/n62/calc"
cp "$ROOT/android/app/src/main/java/dev/n62/calc/FolderNames.java" "$TMP/src/dev/n62/calc/"
cat > "$TMP/src/dev/n62/calc/FolderNamesCheck.java" <<'JAVA'
package dev.n62.calc;

public class FolderNamesCheck {
    public static void main(String[] a) {
        String[] good = {"n62-test.txt", "n62-backup-2026-11-07.json", "Ünïcødé ∑.txt", ".hidden", "a".repeat(255), "é".repeat(127)};
        String[] bad = {null, "", ".", "..", "a/b", "../x", "a\\b", "a\0b", "a".repeat(256), "é".repeat(128)};
        int n = 0;
        for (String s : good) { if (!FolderNames.valid(s)) fail("refused " + s); n++; }
        for (String s : bad) { if (FolderNames.valid(s)) fail("accepted " + s); n++; }
        System.out.println("folder-names: " + n + " passed");
    }
    static void fail(String m) { System.out.println("folder-names: FAILED, " + m); System.exit(1); }
}
JAVA
javac -d "$TMP/out" "$TMP/src/dev/n62/calc/"*.java
java -cp "$TMP/out" dev.n62.calc.FolderNamesCheck
