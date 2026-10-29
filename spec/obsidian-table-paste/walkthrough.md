# Walkthrough: Obsidian plugin to paste HTML and ASCII tables as Markdown

Built "Table Formatter", an Obsidian plugin that hooks the editor's paste event. When the clipboard holds an HTML table, or an ASCII, box-drawing or psql table, it pastes a clean GFM Markdown table. Everything else in the paste is converted by Obsidian's own `htmlToMarkdown()`, and pastes without a table fall through to the native paste. The clipboard is only read, never written.

## What Was Implemented

### 1. Project scaffold
- **`package.json`, `tsconfig.json`, `esbuild.config.mjs`, `.gitignore`**: these follow the layout of the current `obsidian-sample-plugin`.
  - The template now gets Node built-ins from `node:module`, so the plan's `builtin-modules` dependency was dropped.
  - `tsconfig.json` sets `allowImportingTsExtensions` and `erasableSyntaxOnly`. With those, Node 22's built-in type stripping runs the converter sources directly from the scratch tests, with no compile step.
  - `npm test` builds first, then runs `scratch/run_tests.mjs`.
- **`manifest.json`, `versions.json`, `LICENSE`**: id `table-formatter`, `minAppVersion` 1.1.0, `isDesktopOnly: false`, MIT license.

### 2. Table model
- **`src/table-model.ts`**: `TableGrid` plus `renderGfmTable()`, which both parsers share.
  - Pads ragged rows to the same column count.
  - Escapes pipes that aren't already escaped, and turns line breaks inside a cell into `<br>`.
  - Pads columns by code point and writes the alignment row.

### 3. HTML tables
- **`src/html-tables.ts`**: `htmlTableToGrid()` and `convertHtmlPaste()`.
  - Uses only generic DOM calls (children, attributes), so it works the same in Obsidian and under linkedom in the tests.
  - Expands `colspan`/`rowspan`, picks the header row, and flattens nested tables.
  - Takes alignment from the header cell, or from the body cells when they all agree.
  - Each table, and each `<pre>` that holds an ASCII table, is swapped for an alphanumeric placeholder token. Obsidian's converter handles the rest, then the rendered tables replace the tokens. A table inside a list item is moved below the item; one inside a blockquote keeps its `>` prefix.
  - `<style>` and `<script>` blocks are removed first, so the CSS Google Sheets puts on the clipboard can't land in the note.
  - **Beyond the plan:** a header spread over several rows (e.g. "Population" spanning "2010"/"2020") is combined into one row. Each column gets its stacked labels ("Population 2010"), because GFM allows only one header row. A single header row still follows the plan: merged cells leave the covered positions empty.

### 4. ASCII tables
- **`src/ascii-tables.ts`**: `parseAsciiTable()`, `parsePsqlTable()` and `convertAsciiTables()`.
  - **Bordered tables:** box-drawing (light, heavy, double, rounded, mixed) and `+---+` grids. Column boundaries come from the junctions on border lines, measured in terminal display columns so CJK text keeps its columns. Lines that don't line up fall back to splitting on the bars.
  - **Headers and rows:** border lines split the content into groups. When rules also separate the data rows, each group becomes one row, and wrapped lines are joined with `<br>`.
  - **psql:** columns are cut at the `+` positions of the underline, and the `(N rows)` footer is dropped.
  - **Text around tables:** kept exactly, with blank lines added as needed and the paste's own CRLF/LF line endings preserved.
  - **Not converted:** Markdown tables, single-column boxes, bare `| a | b |` lines with no border, and whitespace-aligned columns.

### 5. Plugin wiring
- **`src/settings.ts`**: two toggles, "Convert HTML tables" and "Convert ASCII tables".
- **`src/main.ts`**: `TableFormatterPlugin`.
  - The `editor-paste` handler skips pastes another plugin already handled, and calls `preventDefault()` + `replaceSelection()` only when it converted something.
  - **Paste as plain text (TASK-8):** Ctrl/Cmd+Shift+V is detected from its keydown, in the main window and in pop-out windows. The paste right after it is left alone.
  - **Obsidian's HTML setting (TASK-9):** it's read through `vault.getConfig('autoConvertHtml')`. When it's off, HTML tables are left alone, but ASCII tables in plain text still convert.
  - **ASCII setting:** it governs ASCII tables found in HTML `<pre>` blocks too, through a `convertAsciiInPre` option on `convertHtmlPaste`, so turning it off stops every ASCII conversion.

### 6. Documentation
- **`README.md`**: what the plugin converts, with before/after examples, supported ASCII layouts and what's out of scope, the plain-text escape hatch, settings, manual install and building from source. Both examples were run through the converters, and the README shows their actual output.

### Two plan items done differently
- **TASK-8:** the plan said to first observe in Obsidian whether Ctrl+Shift+V fires `editor-paste`. I couldn't run Obsidian at that point, so the keydown detection was added regardless, since Chromium delivers paste-as-plain-text as an ordinary paste event. The later run in Obsidian (see Results) confirmed that `editor-paste` does fire for it, carrying only `text/plain`, so the detection is needed.
- **TASK-9:** the plan said to confirm the setting key by toggling it in a vault. Instead it was confirmed by finding `getConfig("autoConvertHtml")` in the paste code of the installed Obsidian 1.14.5 app bundle, which also shows the setting defaults to on. Your vault was not opened.

## Verification & Test Results

### Automated Tests
Ran `npm test`, which type-checks, builds `main.js` and runs 4 scratch scripts with `node`. Final run: **80 checks, all passed**. The fixtures in `scratch/fixtures/` are synthetic.

- `scratch/test_table_model.ts` (14 checks): pipe escaping (bare, already escaped, after an escaped backslash, adjacent); newline to `<br>`; ragged rows padded; alignment row; CJK/emoji padding; empty grid. **Passed.**
- `scratch/test_html_tables.ts` (16 checks): **Passed.**
  - A `<thead>` table, with alignment.
  - A Google Sheets-style table promotes its first row.
  - `colspan`/`rowspan` expand, and a grouped header combines.
  - Links, bold, italics, images and inline code survive, with the pipe escaped inside code.
  - A nested table is flattened, and a caption is placed above its table.
  - A `role="presentation"` table returns `null`.
  - In a mixed paste, the surrounding Markdown is identical to the converter's own output.
  - A full Sheets clipboard document produces no CSS.
  - Chrome's partial-selection fragment converts.
  - Two tables keep their order; a table in a list item and one in a blockquote are placed correctly.
  - No tables returns `null`.
- `scratch/test_ascii_tables.ts` (30 checks): **Passed.**
  - Light, heavy, double, rounded/Rich and mixed box styles.
  - A Claude-Code-style table whose wrapped cell merges into one row.
  - A MySQL grid with `|` inside a cell; tabulate grid; CJK columns; indented tables with trailing spaces; promoted first line.
  - psql, with its footer dropped and inside a shell transcript.
  - Surrounding text kept exactly, blank lines not doubled, CRLF kept, two tables in one paste.
  - A `<pre>` table converts inside an HTML paste, and ordinary code in a `<pre>` is left alone.
  - Null cases: whitespace-aligned columns, a Markdown table, a drawn box, prose, bare pipe lines, ragged rows.
- `scratch/test_plugin.ts` (20 checks): loads the **built** `main.js` against a fake `obsidian` module and fires simulated paste and keydown events. **Passed.**
  - Converts HTML; non-table pastes fall through; pastes another plugin handled are ignored.
  - Each toggle off falls through.
  - Ctrl+Shift+V and Cmd+Shift+V skip conversion for exactly one paste, and plain Ctrl+V still converts.
  - `autoConvertHtml` false, true and missing all behave as intended.
  - Terminal ASCII converts, including when non-table HTML is also on the clipboard and when Obsidian's HTML conversion is off.

Two checks failed on their first run because of mistakes in the test scripts, not in the plugin. One was a heredoc in the shell that stripped backslashes from the expected strings; the file was rewritten directly. The other was whitespace normalization in a test helper that rewrote the `--` in `--verbose`. Both were fixed in the tests. Neither required a change to plugin code.

### Regression Testing
Every scratch script was re-run with each item from TASK-3 onward, and all passed at every commit. `npm run build` (`tsc -noEmit` + esbuild) passes with no errors. The production bundle `requires` only `obsidian`. It contains no test-only libraries and no Node built-ins, which matters for mobile.

## Manual Verification

Nothing here has been run inside Obsidian yet: the tests use turndown in place of Obsidian's `htmlToMarkdown()`. Please run these before relying on the plugin.

**Setup:** run `npm run build`. Create `<vault>/.obsidian/plugins/table-formatter/`, copy `main.js` and `manifest.json` into it, then in Settings → Community plugins reload the list and enable **Table Formatter**. A throwaway test vault is safest.

1. **Wikipedia table with merged headers.** In Chrome, copy a whole Wikipedia table that has merged header cells and paste it into a note. Switch to Reading view. It should show one rendered table, not raw HTML, with merged cells as empty cells and a grouped header combined into one row.
2. **Partial table.** Select only a few rows of a table on an MDN or GitHub page, copy and paste. You should get a valid table whose header is the first selected row.
3. **Mixed content.** Copy a paragraph, a table and the paragraph after it in one selection, then paste. Both paragraphs should come out as normal Markdown, with the table between them and a blank line on each side.
4. **Spreadsheet.** Copy a range of cells in Google Sheets (and Excel, if you have it), then paste. A table should appear with the first row as its header, and no CSS text.
5. **Terminal tables.** Copy a box-drawing table that Claude Code printed in your terminal, then paste. It should become a Markdown table. Repeat with `mysql` or `psql` output if you have them, and with an ASCII table inside a code block on a web page.
6. **No table.** Copy a page section with headings, lists, links and an image, but no table, and paste it. Then disable the plugin and paste again. The two results should be identical.
7. **Paste as plain text.** Press Ctrl+Shift+V with a copied HTML table, then with a terminal ASCII table. Both should paste as raw text, unconverted. Then press Ctrl+V on the same clipboard; it should convert.
8. **Obsidian's HTML setting off.** Turn off Settings → Editor → "Convert pasted HTML to Markdown". Paste an HTML table: Obsidian should paste plain text, with no conversion. Paste a terminal ASCII table: it should still convert. Turn the setting back on.
9. **Plugin toggles.** In the plugin's settings, turn off "Convert HTML tables" and paste an HTML table; it should paste natively. Turn it back on. Do the same with "Convert ASCII tables" and a terminal table.
10. **Undo.** After any converted paste, press Ctrl+Z once. The whole paste should be undone.
11. **Mobile** (optional). On Obsidian mobile, copy a table in a mobile browser and paste it into a note. It should convert.
12. **Other apps.** Paste the same copied table into Google Sheets or Word. It should behave exactly as it did before, since the clipboard was never changed.

### Results (2026-10-29, run by Claude in Obsidian 1.14.5)

**How the checks were run:**
- **Isolated instance:** a separate Obsidian 1.14.5 instance with its own profile and a throwaway test vault, controlled through Chrome DevTools remote debugging. It ran the 0.2.0 build.
- **Real input:** each check put content on the real system clipboard and pressed real keys (Ctrl+V, Ctrl+Shift+V, Ctrl+Z). The script then read the note's Markdown and, for tables, the rendered Reading view.
- **Test data:** for checks 1–3, real table markup from Wikipedia's "List of tallest buildings", wrapped the way Chrome puts a copy on the clipboard. Elsewhere, the fixtures in `scratch/fixtures/`.

| Check | Result |
| --- | --- |
| 1. Whole table with merged headers | **Passed.** One rendered table (98 body rows + header, 11 columns), no raw HTML. The two-row header combined into `Height m` / `Height ft`. The first header is empty because Wikipedia's rank column header is empty. |
| 2. Partial selection | **Passed.** Three copied rows became a table headed by the first one. |
| 3. Paragraph + table + paragraph | **Passed.** Both paragraphs pasted as Markdown, with the table between them and blank lines on each side. |
| 4. Google Sheets copy | **Passed** (fixture modeled on Sheets' clipboard HTML). First row as header, no CSS. |
| 5. Terminal tables | **Passed** for the Claude Code box table, a MySQL grid and psql output, each pasted with Windows line endings, and for a box table inside a web page code block. |
| 6. Content without a table | **Passed.** 1,735 characters, identical with the plugin enabled and disabled. |
| 7. Ctrl+Shift+V | **Passed.** Obsidian does fire `editor-paste` for it, with only `text/plain` on the event, and the plugin leaves it alone for both HTML and ASCII tables. The next Ctrl+V converts again. |
| 8. "Convert pasted HTML to Markdown" off | **Passed.** HTML tables pasted as plain text; terminal tables still converted. |
| 9. Plugin toggles | **Passed.** With "Convert HTML tables" off, Obsidian's own conversion ran (`\|A\|B\|…`). With "Convert ASCII tables" off, the terminal table pasted unchanged. |
| 10. Undo | **Passed.** One Ctrl+Z restored the note to its exact pre-paste text. |
| 11. Mobile | **Not run.** |
| 12. Pasting elsewhere | **Passed**, checked by comparing the clipboard's HTML and text before and after a converted paste: identical. Pasting into Sheets or Word wasn't tried. The full run first reported this check as failed; a focused rerun showed that was a fault in the test script's comparison, not in the plugin. |

**Real Chrome copies:** a second run copied tables in Chrome with a real Ctrl+C, then pasted them into the same isolated Obsidian instance. Each paste was compared with Obsidian's own paste (plugin disabled).

| Case | Result |
| --- | --- |
| A. Whole Wikipedia table with merged headers ("List of tallest buildings") | Converts: one rendered table, 98 body rows plus the combined header, no raw HTML. **Bug: every column is centered.** Chrome writes each element's computed styles into the copied HTML, and header cells are centered by default. The plugin takes a column's alignment from its header cell first, so the left-aligned "Name" and right-aligned height columns were centered too. Obsidian's own paste sets no alignment. |
| B. Partial selection, starting mid-row | Converts. **Bug: the first row is shifted one column left.** Chrome copies a row that the selection starts partway through without the cells before the starting point, and the plugin pads short rows on the right. The row's alignment is shifted with it. Obsidian's own paste is worse here: a 10-column table that cuts off the 11-cell rows. |
| C. Paragraph + table + paragraph | **Passed.** The text around the table is identical to Obsidian's own paste. Every row has 6 cells, where Obsidian's own paste leaves some rows with 5 because it doesn't expand merged cells. Columns are centered, from the same alignment bug as case A. |
| D. Text inside a single cell | **Passed.** Identical to Obsidian's own paste, with no table. |
| E. GitHub-rendered table (this repo's README) | **Passed.** Pipes inside inline code are escaped correctly. |

During these runs, another process was also writing to the system clipboard. All five cases were rerun once it had stopped. The results above come from the rerun and match the first run. That overlap may also explain why check 12 first failed in the run above.

**Not covered:** content copied directly from Google Sheets, Excel, Word or a terminal, and mobile. Their clipboard data was built to match each app's format instead.

## Follow-ups
- **Tab-separated spreadsheet paste** (requested mid-implementation). Apps that copy only tab-separated text, with no HTML table, aren't converted yet. That may include GridCraft. It needs a new plain-text path, so it gets its own spec, `spec/spreadsheet-tsv-paste`. Excel and Google Sheets are already covered, because they copy an HTML table.
- **Wrapped cells in ASCII tables** are joined with `<br>`, as the plan specifies. For word-wrapped prose such as Claude Code's descriptions, joining with a space would read more naturally. That's a one-line change in `mergeLines` if you'd prefer it.
- **ASCII tables outside a `<pre>`.** When an HTML paste holds an ASCII table that isn't in a `<pre>`, the plugin converts it from the plain-text version of the paste. Any rich formatting in the rest of that paste is lost in that case.
- **`manifest.json` author** is set to your full name. Your privacy rules only list LICENSE and copyright lines for that, so confirm or change it to your GitHub username before publishing.
- **Community plugin directory.** Publishing there would need a GitHub release with `main.js` and `manifest.json` attached, plus a submission to `obsidianmd/obsidian-releases`. Not done.
- **Old Obsidian versions.** `htmlToMarkdown()` has no `@since` tag. `minAppVersion` 1.1.0 is based on `editor-paste`, and hasn't been tested on versions that old.
