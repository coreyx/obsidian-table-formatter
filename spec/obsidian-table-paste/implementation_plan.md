---
status: approved
---

# Obsidian plugin: paste HTML and ASCII tables as Markdown tables

An Obsidian plugin that steps in when you paste into the editor. If the clipboard holds an HTML table (copied from a browser, Google Sheets, Excel, Word) or an ASCII/box-drawing table (copied from a terminal, Claude Code, a CLI tool, a browser console), it pastes a clean GFM Markdown table. Everything else in the paste is converted exactly as Obsidian would convert it. The clipboard itself is never modified, so copying keeps working normally in every other app, and no browser extension is needed.

## User Review Required

> [!IMPORTANT]
> **The plugin takes over any paste whose HTML contains a `<table>`.** It converts the non-table parts with Obsidian's own exported `htmlToMarkdown()`, so they should come out the same as a normal paste. Our own conversion only runs on the tables, and on `<pre>` blocks that hold an ASCII table. If Obsidian's built-in paste does extra work that `htmlToMarkdown()` doesn't, such as image handling, mixed pastes could differ slightly from today. Manual verification step 6 checks for this.

> [!IMPORTANT]
> **Paste-as-plain-text (Ctrl/Cmd+Shift+V) is the way to skip conversion.** It should never be converted, so it stays available for pasting the raw text. TASK-8 first checks whether that shortcut fires the `editor-paste` event at all, and adds detection only if it does.

> [!NOTE]
> **How tables are shaped:**
> - **Header row:** taken from `<thead>`, or from a first row made entirely of `<th>`. If neither exists, the first row is promoted to the header. That matches what Google Sheets and Excel put on the clipboard: `<td>` cells, with column names in the first row.
> - **Spans:** a cell with `colspan` or `rowspan` keeps its content in its first position, and the cells it covers are left empty.
> - **Cell contents:** multi-line content is joined with `<br>`, and `|` is escaped as `\|`.
> - **Alignment:** `align` or `text-align` on header cells becomes `:---`, `:---:` or `---:`.
> - **Captions:** a `<caption>` becomes a plain paragraph above the table.
> - **Layout tables:** a table marked `role="presentation"` or `role="none"` is left to Obsidian's normal conversion.

> [!NOTE]
> **ASCII detection requires border characters.** Supported:
> - Box-drawing tables: light, heavy, double and rounded corners (`┌─┬─┐ │ ├─┼─┤`, `┏━┳━┓`, `╔═╦═╗`, `╭─╮`).
> - `+---+` / `|` grids: MySQL, prettytable, tabulate "grid".
> - psql-style tables: no outer border, header underlined with `---+---`.
>
> Columns lined up with spaces only (`docker ps`, `kubectl get`, tabulate "simple") are **out of scope**, because they can't be told apart reliably from ordinary aligned text. Markdown tables that are already valid are pasted unchanged.

## Open Questions

1. **The "Convert pasted HTML to Markdown" setting.** The plan honors it: when it's off, HTML tables aren't converted, but ASCII tables in plain text still are. Obsidian doesn't document the setting's key. I'll read it with `app.vault.getConfig('autoConvertHtml')`, and if that turns out unavailable or misnamed (checked in TASK-9), I'll treat the setting as on.
2. **Plugin identity.** The plan assumes id `table-formatter`, display name "Table Formatter", and an MIT license with your name in `LICENSE`. Change any of these if you'd like.
3. **`minAppVersion`.** `editor-paste` exists since 1.1.0. `htmlToMarkdown()` has no `@since` tag in `obsidian.d.ts`, but it's older than that. I'll set `minAppVersion` to `1.1.0` unless something turns up while building.

## Proposed Changes

### Project scaffold

Based on the layout of the official `obsidianmd/obsidian-sample-plugin` template, trimmed to what this plugin needs.

#### [NEW] `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `.gitignore`
- [x] **TASK-1:** Create the build setup.
  - `package.json` scripts: `dev` (esbuild watch), `build` (`tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`), `test` (runs every `scratch/test_*.ts` with `node`).
  - Dev dependencies: `obsidian`, `typescript`, `esbuild`, `builtin-modules`, `@types/node`, `tslib`, plus `linkedom` and `turndown`, used by the scratch tests only and never bundled.
  - `tsconfig.json`: `strict`, `allowImportingTsExtensions`, `noEmit`, `erasableSyntaxOnly`. Imports between source files use the `.ts` extension, so Node 22's built-in type stripping can run the converter files directly from the scratch tests.
  - `esbuild.config.mjs`: bundles `src/main.ts` to `main.js` as CommonJS, with `obsidian`, `electron` and the Node built-ins marked external.
  - `.gitignore`: `node_modules/`, `main.js`, `data.json`.

#### [NEW] `manifest.json`, `versions.json`, `LICENSE`
- [x] **TASK-2:** Add the plugin manifest: id `table-formatter`, name "Table Formatter", version `0.1.0`, `minAppVersion` `1.1.0`, `isDesktopOnly: false`, plus description and author. Add `versions.json` mapping `0.1.0` to `1.1.0`, and an MIT `LICENSE`.

### Shared table model

#### [NEW] `src/table-model.ts`
- [x] **TASK-3:** Define `TableGrid` (`{ header: string[]; rows: string[][]; align: Align[] }`, with `Align` = `'left' | 'center' | 'right' | null`), and `renderGfmTable(grid): string`.
  - Pads short rows so every row has the same column count.
  - Escapes unescaped `|` as `\|`, turns newlines inside a cell into `<br>`, and trims cell whitespace.
  - Pads each column to its widest cell so the source Markdown reads well, measuring width in code points.
  - Writes the alignment row from `align`.
  - Uses no DOM and no Obsidian API.

### HTML table conversion

#### [NEW] `src/html-tables.ts`
- [x] **TASK-4:** `htmlTableToGrid(table: HTMLTableElement, cellToMarkdown: (el: HTMLElement) => string): TableGrid`.
  - Builds a grid that expands `colspan`/`rowspan` into empty cells.
  - Picks the header row using the rules in User Review Required.
  - Reads alignment from header cells.
  - Converts each cell with `cellToMarkdown`, the Obsidian converter injected from outside. A table nested inside a cell is flattened to its text, with rows joined by `<br>`.
- [x] **TASK-5:** `convertHtmlPaste(html: string, deps: { parse: (html: string) => Document; htmlToMarkdown: (el: HTMLElement | DocumentFragment | string) => string }): string | null`.
  - Parses the HTML and returns `null` (meaning: fall through to native paste) when it contains no convertible `<table>` and no ASCII-table `<pre>`. The `<pre>` check is wired in at TASK-12.
  - Replaces each outermost convertible table with a `<p>` holding an alphanumeric placeholder token (`TFTABLE0`, `TFTABLE1`, …). The token has no Markdown-special characters, so `htmlToMarkdown()` leaves it alone.
  - Runs `htmlToMarkdown()` on the rest, then swaps each token line for its rendered table, keeping a blank line before and after. A `<caption>` is written as a plain line just above the table.
  - If a token ends up mid-line, for example inside a list item, the table is moved onto its own lines right after that line.

### Plugin wiring

#### [NEW] `src/settings.ts`
- [x] **TASK-6:** `TableFormatterSettings` with `convertHtmlTables: boolean` and `convertAsciiTables: boolean` (both default `true`), and a `PluginSettingTab` with a toggle for each.

#### [NEW] `src/main.ts`
- [ ] **TASK-7:** `TableFormatterPlugin extends Plugin`.
  - `onload` loads settings, adds the settings tab, and registers `this.app.workspace.on('editor-paste', this.handlePaste)` through `this.registerEvent`.
  - `handlePaste(evt, editor)`:
    1. Return if `evt.defaultPrevented` is set or `evt.clipboardData` is missing.
    2. Read `text/html`. If it's present, `convertHtmlTables` is on and HTML conversion is enabled (TASK-9), call `convertHtmlPaste` with `parse` (a `DOMParser`) and Obsidian's `htmlToMarkdown`.
    3. If that returns a string, call `evt.preventDefault()` and `editor.replaceSelection(result)`, which undoes in a single step.
    4. Otherwise return without touching anything, so the native paste runs.
- [ ] **TASK-8:** Find out whether Ctrl/Cmd+Shift+V fires `editor-paste`, by logging in the dev console during a test paste.
  - If it does, track Shift on the `keydown` that started the paste (`registerDomEvent` on the document) and skip conversion for it.
  - If it doesn't, no code is needed; record the result in the walkthrough.
- [ ] **TASK-9:** `isHtmlConversionEnabled()`.
  - Reads `(this.app.vault as any).getConfig?.('autoConvertHtml')` and treats anything other than `false` as on.
  - Confirm the key against a real vault: toggle the setting and inspect `.obsidian/app.json`. Correct the key if it's named differently.
  - When HTML conversion is off, `handlePaste` skips the HTML path. Only the plain-text ASCII path runs (TASK-13).

### ASCII table conversion (last, per the original nice-to-have)

#### [NEW] `src/ascii-tables.ts`
- [ ] **TASK-10:** `parseAsciiTable(lines: string[]): TableGrid | null` for box-drawing and `+---+` grids.
  - Takes column boundaries from the junction positions (`┬ ┼ ┴ ╋ ╦ ╬ +`) on border lines, so a `|` inside a cell doesn't split it. Falls back to splitting on the vertical bar characters when no border line exists.
  - The first separator line after the first content row marks the header.
  - If there are separator lines between data rows, the content lines between two separators form one row, joined with `<br>`. Otherwise each content line is a row.
  - Returns `null` when the lines don't form a consistent grid, meaning differing column counts or misaligned boundaries.
- [ ] **TASK-11:** `parsePsqlTable(lines)` for the borderless psql layout: a header line, a `---+---` underline, rows split at the `+` positions, and an optional trailing `(N rows)` line that is dropped.
- [ ] **TASK-12:** `convertAsciiTables(text: string): string | null`.
  - Scans the text for runs of consecutive lines that start and end with border characters, or match the psql layout. Tolerates trailing whitespace and a common leading indent.
  - Parses each run and replaces it with `renderGfmTable` output, with a blank line before and after.
  - Leaves all other text byte-for-byte unchanged, and returns `null` if nothing was converted.
  - Also wire it into `convertHtmlPaste`: a `<pre>` whose text converts gets a placeholder and its table, in the same way as an HTML table.

#### [MODIFY] `src/main.ts`
- [ ] **TASK-13:** Add the plain-text path to `handlePaste`. If the HTML path didn't handle the paste and `convertAsciiTables` is on, run `convertAsciiTables(text/plain)`. If it returns a string, call `preventDefault` and `replaceSelection`. This runs whether or not HTML conversion is on: with HTML conversion off, Obsidian would paste the plain text anyway.

### Documentation

#### [NEW] `README.md`
- [ ] **TASK-14:** Write the README: what the plugin does, a before/after example for each kind of table, supported ASCII styles and what's out of scope, the plain-text-paste escape hatch, settings, how to install manually (copy `main.js` + `manifest.json` into `<vault>/.obsidian/plugins/table-formatter/`) and how to build from source.

## Verification Plan

### Automated Tests

Every check prints PASS or FAIL. The scripts run with `node` (Node 22's built-in type stripping), use `linkedom` for `DOMParser`, and use `turndown` as a stand-in for Obsidian's `htmlToMarkdown()`, which is itself turndown-based. Fixtures in `scratch/fixtures/` are synthetic HTML and text built to match the structure of real sources, with no copied content.

`scratch/test_table_model.ts`:
1. Pipe escaping, including a pipe that's already escaped.
2. Newline to `<br>`.
3. Ragged rows padded.
4. The alignment row for each `Align` value.
5. Column padding with wide (CJK/emoji) characters doesn't break the table.

`scratch/test_html_tables.ts`:
1. A table with `<thead>`/`<th>` gives the expected Markdown.
2. A Google-Sheets-style table (all `<td>`) promotes its first row.
3. `colspan` and `rowspan` expand to empty cells in the right positions.
4. Links, bold, inline code and images inside cells survive. A `|` inside inline code is escaped.
5. A nested table is flattened into its cell.
6. `<caption>` is written above the table.
7. A `role="presentation"` table returns `null` when it's the only table.
8. A mixed paste (heading, paragraph, table, list) keeps the non-table Markdown the same as the stub converter's output for the same HTML without the table.
9. A partial Chrome selection fragment, `<table><tbody><tr>…` without `<thead>`, converts.
10. HTML with no tables returns `null`.

`scratch/test_ascii_tables.ts`:
1. Light, heavy, double and rounded box-drawing tables each convert.
2. Claude-Code-style tables with separators between rows and multi-line cells merge into one row, joined with `<br>`.
3. A MySQL `+---+` grid converts.
4. A psql table converts and its `(N rows)` footer is dropped.
5. A `|` inside a cell of a bordered grid isn't split.
6. Text around a table is unchanged byte for byte.
7. Two tables in one paste both convert.
8. Whitespace-aligned columns, an existing Markdown table, a drawn box with no columns, and ordinary prose all return `null`.
9. `convertHtmlPaste` converts a `<pre>` that holds a box-drawing table.

`npm run build` must finish with no TypeScript errors.

### Manual Verification

In a test vault, with the built plugin copied into `<vault>/.obsidian/plugins/table-formatter/` and enabled:

1. In Chrome, copy a whole Wikipedia table that has merged header cells, paste it into a note, and switch to Reading view. It shows as a single rendered table, not raw HTML, with merged cells as empty cells.
2. Select only some rows of a table on an MDN or GitHub page, copy and paste. You get a valid table whose header is the first selected row.
3. Copy a paragraph, a table and the paragraph after it in one selection. Both paragraphs paste as normal Markdown, the table sits between them with blank lines around it, and the rendered note looks right.
4. Copy a range of cells in Google Sheets (or Excel), then paste. A table appears with the first row as its header.
5. Copy a box-drawing table from Claude Code in a terminal, then paste. A Markdown table appears. Repeat with `mysql` or `psql` output if you have it, and with an ASCII table in a browser code block.
6. Copy a page section that contains no table, such as headings, lists, links and an image, then paste. The result matches what you got with the plugin disabled, so check both ways.
7. Press Ctrl+Shift+V on a copied table. The raw plain text is pasted, unconverted.
8. Turn off Settings → Editor → "Convert pasted HTML to Markdown" and paste an HTML table: there's no conversion, so you get Obsidian's plain-text paste. Paste a terminal ASCII table: it still converts.
9. Turn off each of the plugin's toggles in turn and confirm that kind of table pastes natively.
10. After any converted paste, press Ctrl+Z once. The whole paste is undone.
11. On Obsidian mobile, if available: copy a table in a mobile browser and paste it into a note. It converts.
12. Paste the same data into Google Sheets or Word. It behaves exactly as before, since the clipboard was never changed.
