---
status: approved
---

# Paste tab-separated spreadsheet data as Markdown tables

Some spreadsheet and table apps copy cells only as tab-separated plain text, with no HTML table on the clipboard. Version 0.1.0 already converts copies from Excel and Google Sheets, because those include an HTML table. This change adds a third path: when a paste is nothing but tab-separated rows, it becomes a Markdown table, with the first row as the header.

**Related documents**
- [Table paste plan](../obsidian-table-paste/implementation_plan.md)

## User Review Required

> [!IMPORTANT]
> **Only clipboards with no HTML at all are treated as spreadsheet data.** This is what keeps code from being turned into a table. Editors like VS Code put HTML on the clipboard next to the plain text, and tab-aligned code there would otherwise look like a table. The catch: an app that copies tab-separated text together with non-table HTML won't be converted. Manual check 1 shows which kind GridCraft is.

> [!IMPORTANT]
> **Tab-aligned plain text from an HTML-free source** (e.g. Notepad or a terminal) can still be mistaken for a table. To reduce that risk, the whole paste must be tab-separated rows:
> - at least 2 non-empty rows and 2 columns;
> - the same number of columns on every row;
> - not every row starting with a tab, which is what tab indentation looks like.
>
> When a paste is wrongly converted, Ctrl+Shift+V and a new settings toggle are the ways out.

> [!NOTE]
> - **Header:** the first row is always the header, as with spreadsheet HTML.
> - **Quoted cells:** a cell holding a line break or tab is quoted, the way Excel and Sheets write them (`"line one` / `line two"`, with `""` for a literal quote). It's unquoted, and its line breaks become `<br>`.
> - **Empty trailing line:** a single trailing line break, which most apps add, is ignored.
> - **Out of scope:** comma-separated text, because commas are too common in ordinary prose to detect reliably.

## Open Questions

1. **Does GridCraft copy HTML or only tab-separated text?** If it copies an HTML table, it already works in 0.1.0. If it copies tab-separated text with non-table HTML, this plan won't cover it, and we'd need to look at its clipboard. Manual check 1 answers this.

## Proposed Changes

### Tab-separated parsing

#### [NEW] `src/tsv-tables.ts`
- [ ] **TASK-1:** `parseTsv(text: string): TableGrid | null` and `convertTsvPaste(text: string): string | null`.
  - `parseTsv` reads rows and fields with tab and newline as separators. A field starting with `"` is quoted: it runs to the closing `"`, `""` stands for a literal quote, and tabs and line breaks inside it belong to the cell. Both `\r\n` and `\n` count as line breaks.
  - It returns `null` when there are fewer than 2 non-empty rows or 2 columns, when column counts differ, when every row's first field is empty, or when a quote is left unclosed.
  - The first row becomes `header` and the rest `rows`, with no alignment.
  - `convertTsvPaste` returns `renderGfmTable(parseTsv(text))`, or `null` if parsing fails.

### Settings

#### [MODIFY] `src/settings.ts`
- [ ] **TASK-2:** Add `convertTsvTables: boolean` (default `true`) to `TableFormatterSettings` and `DEFAULT_SETTINGS`, with a "Convert tab-separated data" toggle described as "Paste rows copied as tab-separated text, as some spreadsheet apps do, as Markdown tables."

### Plugin wiring

#### [MODIFY] `src/main.ts`
- [ ] **TASK-3:** In `convertClipboard()`, after the HTML path and before the ASCII path, call `convertTsvPaste(text)` when the clipboard has no `text/html` and `convertTsvTables` is on, and return its result if it isn't `null`.
  - Ctrl+Shift+V already skips every conversion, so it skips this one too.

## Verification Plan

### Automated Tests
A new `scratch/test_tsv_tables.ts`, plus new checks in `scratch/test_plugin.ts`, run with `npm test`:
1. A 3×3 tab-separated paste becomes a table with the first row as header; a trailing newline is ignored.
2. CRLF line endings parse the same as LF.
3. A quoted cell holding a line break, a tab, and a doubled quote parses to one cell, rendered with `<br>` and a single `"`.
4. Empty cells, including a whole empty column in the middle, are kept.
5. A `|` in a cell is escaped.
6. Returns `null` for: a single row; a single column; ragged rows; tab-indented code (every row starting with a tab); an unclosed quote; text with no tabs.
7. In the plugin: a paste with only tab-separated `text/plain` converts. The same text alongside non-table `text/html` is not converted. The toggle off falls through. Ctrl+Shift+V falls through. An ASCII box table still converts.
8. All existing scratch scripts still pass.

### Manual Verification
1. **GridCraft:** copy a range of cells and paste it into a note. If a table appears, note whether it already did in 0.1.0 (an HTML table) or only with this version (tab-separated text). If nothing converts, tell me; that's the case Open Question 1 describes.
2. **A tab-only source:** in Google Sheets, select cells and copy. Paste into Notepad, then copy from Notepad, so the clipboard holds only tab-separated text. Paste into Obsidian; a table should appear with the first row as its header.
3. **A cell with a line break:** in Google Sheets, put a line break in one cell (Ctrl+Enter) and repeat step 2. The cell should show the break as `<br>`, in a single table row.
4. **Code isn't converted:** copy tab-indented code from Notepad and paste it. It should paste as normal text.
5. **Escape hatches:** paste tab-separated text with Ctrl+Shift+V; it should stay plain text. Turn off "Convert tab-separated data" and paste normally; it should also stay plain text.
