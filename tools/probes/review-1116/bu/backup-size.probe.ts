// SPDX-License-Identifier: GPL-3.0-or-later
// bu hunt (night review 2026-11-16), finding bu-5: the restore's 4 MB cap (state/backup.ts:112-113, "twice the worst case
// of r11 section 3.3", 1.98 MB measured 2026-10-20) against the history rows as they are kept now. Since r11 a row also
// keeps `giac` (G211, <= FULL_LIMIT, resultItem.ts:27), `ans` (G213f1, a chip value, session.svelte.ts:492) and `reads`
// (G213f1, each <= FULL_LIMIT, resultItem.ts:31). The rows below are r11's worst row (tools/probes/backup-file.mjs
// historyItem, worst) plus those three fields at their caps with one name read; makeBackup writes them as the store
// holds them, then the restore's own check (checkBackup) and the sync's start look (backupSync.ts:141) read the size.
// Run: env -C <review worktree>/app npx vitest run --config <probes>/bu/vitest.config.mts --silent=false backup-size
import { checkBackup, makeBackup, MAX_BACKUP_BYTES } from "../../../../app/src/state/backup.ts";
import { FULL_LIMIT, HISTORY_LIMIT } from "../../../../app/src/state/results.ts";
import { DATA_VERSION } from "../../../../app/src/state/storage.ts";

const pad = (s: string, n: number): string => (s.length >= n ? s.slice(0, n) : s + "x".repeat(n - s.length));
function row(i: number, view: "home" | "cas", extra: boolean) {
  const r: Record<string, unknown> = {
    id: i, uid: `r${i}`, view, latex: pad("\\frac{\\sin\\left(x\\right)}{x}+", 400), status: "done",
    resultLatex: pad("1.41421356237", 600), text: pad("1.41421356237", 600), approximate: true,
    facts: { exact: false, reliableDigits: 12 }, full: pad("5.0926390649634", FULL_LIMIT), fullExact: false,
    chips: { a: { value: pad("3", 200), exact: true } }, uses: [{ name: "a", preview: pad("3", 200), view }],
  };
  if (extra) Object.assign(r, { giac: pad("evalf(", FULL_LIMIT), ans: { value: pad("7", FULL_LIMIT), exact: false }, reads: [{ name: "M", value: pad("[[1,2]", FULL_LIMIT), exact: true }] });
  return r;
}

test("the worst history then and now against the restore's cap", async () => {
  for (const extra of [false, true]) {
    const history = { home: Array.from({ length: HISTORY_LIMIT }, (_, i) => row(i, "home", extra)), cas: Array.from({ length: HISTORY_LIMIT }, (_, i) => row(i, "cas", extra)) };
    const b = await makeBackup(async (k) => (k === "history" ? { "@n62": DATA_VERSION, value: history } : undefined), new Date("2026-11-16T09:00:00Z"));
    const bytes = new TextEncoder().encode(JSON.stringify(b));
    const c = checkBackup(bytes);
    console.log(`${extra ? "with giac, ans, one read" : "r11's worst row"}: ${bytes.length} bytes (cap ${MAX_BACKUP_BYTES}); restore: ${c.ok ? "ok" : c.message}`);
  }
});
