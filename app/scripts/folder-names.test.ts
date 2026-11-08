// SPDX-License-Identifier: GPL-3.0-or-later
// A65: the sync folder's file-name rule is written twice, in android/.../FolderNames.java (the plugin) and
// app/src/clipboard/folder.ts (the port). folder.test.ts checks the port against tests/fixtures/folder-names.json; this
// runs tools/folder-names.test.sh, which checks the Java copy against the same fixture, so a change to either copy turns
// a merge red. No JDK fails this test; it never skips.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repo = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

describe("the sync folder's name rule in Java (tools/folder-names.test.sh)", () => {
  it("FolderNames.java accepts and refuses every name of the shared fixture", () => {
    const f = JSON.parse(readFileSync(join(repo, "tests/fixtures/folder-names.json"), "utf8")) as { accept: unknown[]; refuse: unknown[] };
    const count = f.accept.length + f.refuse.length;
    expect(count).toBe(16);
    const r = spawnSync(join(repo, "tools/folder-names.test.sh"), { encoding: "utf8", timeout: 120_000 });
    expect(r.stdout + r.stderr).toContain(`folder-names: ${count} passed`);
    expect(r.status).toBe(0);
  });
});
