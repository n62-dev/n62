// SPDX-License-Identifier: GPL-3.0-or-later
// Everything Copy and Paste need that is not needed at start: loaded on the first use (docs/04 section 8.3, start chunk).
export { parsePastedNumber, pasteText } from "./paste.ts";
export { webClipboard, type ClipboardPort } from "./port.ts";
export { choosePort } from "./native.ts";
export { saveFile, type SaveResult } from "./files.ts";
export { copyExactText, copyFull, copyShownText, sessionCsv, sessionLatex, sessionText, tableCsv, withoutMark } from "./text.ts";
export { translateRows, type PyRow, type PyOptions } from "./python.ts";
export { nameCopy } from "./nameCopy.ts"; // R815: a stored name's full value (in this chunk: a chunk of its own would add its name to the start chunk)
