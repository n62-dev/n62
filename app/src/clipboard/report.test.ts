// SPDX-License-Identifier: GPL-3.0-or-later
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { issueUrl, reportText, REPORT_CAP } from "./report.ts";

const form = parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../.github/ISSUE_TEMPLATE/bug.yml"), "utf8")) as {
  body: { id?: string }[];
};

describe("issueUrl", () => {
  it("fills the version and the device of the issue form", () => {
    expect(issueUrl({ version: "0.1.0", device: "Android 14; Tab" })).toBe(
      "https://github.com/n62-dev/n62/issues/new?template=bug.yml&version=0.1.0&device=Android%2014%3B%20Tab",
    );
  });
  it("stays short for a long device string: it is cut to 200 characters, and no session is in it", () => {
    const url = issueUrl({ version: "0.1.0", device: "d".repeat(500) });
    expect(url.length).toBeLessThan(2000);
    expect(url).toContain(`device=${"d".repeat(200)}`);
    expect(url).not.toContain("d".repeat(201));
  });
  it("uses only field ids of bug.yml as query keys", () => {
    const ids = form.body.flatMap((b) => (b.id ? [b.id] : []));
    const keys = [...new URL(issueUrl({ version: "1", device: "x" })).searchParams.keys()].filter((k) => k !== "template");
    expect(keys.length).toBeGreaterThan(0);
    for (const k of keys) expect(ids).toContain(k);
  });
});

describe("reportText", () => {
  it("has the version and the device first, then the session", () => {
    const t = reportText("0.1.0", "Android 14", "1+1 = 2\n2+2 = 4");
    expect(t.split("\n").slice(0, 2)).toEqual(["Version: 0.1.0", "Device: Android 14"]);
    expect(t.endsWith("1+1 = 2\n2+2 = 4")).toBe(true);
    expect(t.indexOf("Device")).toBeLessThan(t.indexOf("1+1"));
  });
  it("keeps a short session whole", () => {
    expect(reportText("v", "d", "a\nb")).not.toMatch(/left out/);
  });
  it("past the cap keeps the newest rows and says how many were left out", () => {
    const rows = Array.from({ length: 3000 }, (_, i) => `row${String(i).padStart(5, "0")} ${"x".repeat(30)}`);
    const t = reportText("0.1.0", "Tab", rows.join("\n"));
    expect(t.length).toBeLessThanOrEqual(REPORT_CAP);
    expect(t).toContain(rows[2999] as string);
    expect(t).not.toContain(rows[0] as string);
    const m = /(\d+) older rows? left out/.exec(t);
    expect(m).not.toBeNull();
    const kept = t.split("\n").filter((l) => l.startsWith("row")).length;
    expect(Number(m?.[1]) + kept).toBe(3000);
  });
});
