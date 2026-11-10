// SPDX-License-Identifier: GPL-3.0-or-later
// bu: what Vars puts on the line for a stored name, and how the parser reads it; the unit view on a line with Ans.
const A = new URL("../../../../app/src", import.meta.url).pathname;
const { latexToGiac, latexToGiacInfo } = await import(`${A}/input/latex-to-giac.ts`);
const { homeResultToLatex } = await import(`${A}/render/home.ts`);
const run = (l: string, o: object = {}) => { try { return latexToGiac(l, o); } catch (e) { return "ERROR " + (e instanceof Error ? e.message : String(e)); } };
test("names", () => {
  for (const n of ["A", "x", "rate", "A1", "k_B", "ab", "x_1", "theta", "pi2"]) {
    const l = homeResultToLatex(n);
    console.log("NAME", n, "latex", l, "giac", run(l));
  }
});
test("unit view line with Ans", () => {
  let out: string;
  try { out = JSON.stringify(latexToGiacInfo("\\ans\\times2\\placeholder[u1]{}", { units: true, chips: {} })); } catch (e) { out = "ERROR " + (e instanceof Error ? e.message : String(e)); }
  console.log("UNITANS", out);
});
test("plain text of inputs", async () => {
  const { entryText } = await import(`${A}/clipboard/plaintext.ts`);
  for (const l of ["1.5\\emark-3", "2\\tfrac12", "2\\tfrac{11}{13}", "3{,}5\\times2", "30\\degree15\\prime36\\doubleprime", "\\log_{16}\\left(256\\right)"]) console.log("TEXT", l, "=>", entryText(l));
});
