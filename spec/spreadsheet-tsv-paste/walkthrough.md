# Walkthrough: Paste tab-separated spreadsheet data as Markdown tables

Added a third conversion path. When the clipboard holds only tab-separated rows and no HTML, as some spreadsheet and table apps copy cells, the paste becomes a Markdown table with the first row as its header. Excel and Google Sheets were already covered by the HTML path, since they also copy an HTML table.

## What Was Implemented

### 1. Tab-separated parsing
- **`src/tsv-tables.ts`** (new): `parseTsv()` and `convertTsvPaste()`.
  - **Quoted fields:** read the way Excel and Sheets write them. A field starting with `"` runs to the closing quote, `""` is a literal quote, and tabs and line breaks inside it stay in the cell.
  - **Line endings:** CRLF and LF both work, and one trailing line break is ignored.
  - **What it rejects:** fewer than two non-empty rows, fewer than two columns, rows with differing column counts, text where every row starts with a tab (indentation), and an unclosed or malformed quote.
  - **Output:** the first row becomes the header, and the table is rendered with the shared `renderGfmTable()`. Line breaks inside quoted cells become `<br>` and pipes are escaped.

### 2. Settings
- **`src/settings.ts`**: a new `convertTsvTables` setting (default on) with a "Convert tab-separated data" toggle.

### 3. Plugin wiring
- **`src/main.ts`**: `convertClipboard()` tries the tab-separated path after the HTML path and before the ASCII path. It runs only when the clipboard has no `text/html` and the setting is on. Ctrl+Shift+V already skips every conversion, so it skips this one too.

### 4. Documentation
- **`README.md`**: the intro mentions tab-separated copies, and a new "Tab-separated spreadsheet data" section explains when a paste counts as spreadsheet data and that comma-separated text isn't converted. The settings list includes the new toggle.

## Verification & Test Results

### Automated Tests
Ran `npm test`, which type-checks, builds `main.js` and runs every scratch script.

- **`scratch/test_tsv_tables.ts`** (new, 13 checks): **all passed.**
  - A 3×3 grid with a trailing newline, and the same with CRLF.
  - A quoted cell with a line break, a tab and a doubled quote; a quoted cell in a CRLF paste.
  - Empty cells, including a whole empty middle column; pipe escaping.
  - `null` for: a single row, a single column, ragged rows, tab-indented code, an unclosed quote, text with no tabs, and only one non-empty row.
- **`scratch/test_plugin.ts`** (5 new checks, run against the built `main.js`): **all passed.**
  - Tab-separated plain text converts.
  - The same text alongside non-table HTML is left alone.
  - The toggle off falls through, and Ctrl+Shift+V falls through.
  - An ASCII box table still converts with the new path on.

### Regression Testing
All five scratch scripts passed on the final run: `test_ascii_tables.ts` (33), `test_html_tables.ts` (16), `test_plugin.ts` (25), `test_table_model.ts` (14) and `test_tsv_tables.ts` (13), for 101 checks. The build reported no errors.

## Manual Verification
Install a build with this change: the next release through BRAT, or run `npm run build` and copy `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/table-formatter/`.

1. **GridCraft:** copy a range of cells in GridCraft and paste it into a note.
   - If a table appears, check whether 0.1.0 already converted it (then GridCraft copies an HTML table) or only this build does (then it copies tab-separated text).
   - If nothing converts, GridCraft probably copies tab-separated text together with non-table HTML, which this change deliberately skips. Let me know and we'll look at what it puts on the clipboard.
2. **A tab-only clipboard:** in Google Sheets, copy some cells and paste them into Notepad. Copy them again from Notepad, so the clipboard holds only tab-separated text, then paste into Obsidian. A table should appear with the first row as its header.
3. **A cell with a line break:** in Google Sheets, put a line break inside one cell (Ctrl+Enter) and repeat step 2. The cell should show `<br>`, and the table should keep one row per spreadsheet row.
4. **Code isn't converted:** copy tab-indented code from Notepad and paste it. It should paste as normal text.
5. **Ways out:** paste tab-separated text with Ctrl+Shift+V; it should stay plain text. Turn off "Convert tab-separated data" and paste normally; it should also stay plain text.

### Results (2026-10-29)
Step 1 was done by hand; steps 2–5 were run by Claude in an isolated Obsidian 1.14.5 instance on the 0.2.0 build, with the real clipboard and real key presses.

| Step | Result |
| --- | --- |
| 1. GridCraft | **Passed** (tested by hand). GridCraft copies tab-separated text, and it pastes as a table. |
| 2. Tab-only clipboard | **Passed.** Rows with Windows line endings became a 3-row table, first row as header. |
| 3. A cell with a line break | **Passed.** The quoted cell became `first line<br>second line`, and the table kept one row per spreadsheet row. |
| 4. Tab-indented code | **Passed.** Pasted unchanged. |
| 5. Ways out | **Passed.** Ctrl+Shift+V and the "Convert tab-separated data" toggle both left the text unchanged. |

## Follow-ups
- **GridCraft** was tested by hand after the 0.2.0 release: copying cells from it and pasting into Obsidian produces a Markdown table (manual step 1). GridCraft copies cells as tab-separated text (confirmed by pasting into a plain-text editor), so the tab-separated path added in this spec is what converts them.
- **Tab-aligned plain text from an app that copies no HTML** (Notepad, a terminal) can still be mistaken for a table if every row has the same number of tabs. Ctrl+Shift+V and the toggle are the ways out.
- **Comma-separated text** is out of scope: commas are too common in ordinary prose to detect reliably.
