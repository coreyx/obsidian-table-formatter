---
status: approved
---

# Fix column alignment and partial selections in Chrome copies

Real copies from Chrome exposed two bugs in the HTML path, both recorded in the [table paste walkthrough](../obsidian-table-paste/walkthrough.md):
- **Every column comes out centered.** Chrome writes each cell's computed styles into the copied HTML, so header cells arrive as `text-align: center`. The plugin takes a column's alignment from its header cell first.
- **A selection starting partway through a row shifts that row one column left.** Chrome leaves out the cells before the selection's start, and the plugin pads short rows on the right.

This change fixes both and adds regression fixtures modeled on those copies. It's intended to ship as 0.2.1.

**Related documents**
- [Table paste plan](../obsidian-table-paste/implementation_plan.md)
- [Table paste walkthrough (Chrome copy results)](../obsidian-table-paste/walkthrough.md)

## User Review Required

> [!IMPORTANT]
> **Alignment will come from the data cells only.** A column is aligned when all of its data cells agree (all `right`, say), and has no alignment otherwise. Header cells are no longer consulted, because in a Chrome copy their alignment is the browser's default, not the page's.
> - **What's lost:** a page that aligns a column only on its header cell, with nothing on the data cells, will paste without that alignment. Copies from Chrome aren't affected by this, since Chrome writes the data cells' alignment out too.
> - **Header-only tables:** a table with no data rows gets no alignment.

> [!IMPORTANT]
> **A short first row will be padded on the left instead of the right**, but only when it looks like a partial selection:
> - the first row covers fewer columns than the table;
> - it isn't in `<thead>`;
> - it has no `<th>` cells.
>
> A header row that genuinely leaves its last cells out is almost always in `<thead>` or made of `<th>` cells, so it keeps today's right padding. A short **last** row (a selection that ends partway through a row) keeps right padding too, which is already correct.

> [!NOTE]
> - **The first row is still the header.** In a partial selection the first row is a data row, and it's promoted to the header as before, now with its cells in the right columns. Making that row a body row under an empty header is out of scope; Obsidian's own paste uses an empty header there.
> - **Merged cells in that first row** move with it: a cell spanning rows down from the first row lands in the same shifted column on the rows below.
> - **No settings change.**

## Open Questions

None at this time.

## Proposed Changes

### HTML tables

#### [MODIFY] `src/html-tables.ts`
- [x] **TASK-1:** Change `columnAlignment()` to take each column's alignment from the data rows only.
  - Gather `readAlign()` from the origin slots of the body rows, as the current fallback does. Return the shared value when every one agrees and is non-null, otherwise `null`.
  - Drop the header-cell lookup and the `headerRows` parameter; update the call in `htmlTableToGrid()`.
  - Rewrite the doc comment to say why header cells are ignored: Chrome inlines computed styles, and header cells compute to `center`.
- [ ] **TASK-2:** Pad a partially selected first row on the left.
  - Give `buildGrid()` a `firstRowOffset` parameter (default `0`): the column where the first row's first cell is placed. Rowspans from that row use the shifted columns too.
  - Add `isPartialFirstRow(rows, theadCount)`: true when there's more than one row, the table has no `<thead>`, and the first row has no `<th>` cells.
  - In `htmlTableToGrid()`, build the grid once. If `isPartialFirstRow()` holds and the first row's width (its slot count) is less than the table's column count, rebuild with `firstRowOffset` set to the difference.
  - Document both, explaining that Chrome leaves out the cells before a selection's start.

### Tests

#### [NEW] `scratch/fixtures/chrome-whole-table.html`
- [ ] **TASK-3:** A synthetic whole-table copy with Chrome's markup.
  - The `<html><body><!--StartFragment-->` wrapper and inline computed styles on every cell.
  - A two-row grouped `<thead>` whose `<th>` cells are all `text-align: center`.
  - Data cells that are `text-align: left` in a name column and `text-align: right` in two number columns, plus one mixed column.
  - Made-up values only (invented building names and heights).

#### [NEW] `scratch/fixtures/chrome-mid-row.html`
- [ ] **TASK-4:** A synthetic partial copy, also with Chrome's wrapper and inline styles.
  - A `<tbody>`-only table whose first row is missing its first two cells and whose last row is missing its trailing cells.
  - A cell with `rowspan="2"` in the first row.
  - Made-up values only.

#### [NEW] `scratch/test_chrome_copies.ts`
- [ ] **TASK-5:** A regression script run by `npm test`, using the existing `harness.ts` and `dom.ts` helpers.
  1. **Whole-table fixture:** the delimiter row is `:---` / `---:` / `---:` / `---`. That's left, right, right, and none for the mixed column; nothing is centered.
  2. **Mid-row fixture:** the first row's cells sit in the last columns with empty cells before them, and the rowspan's shifted column is empty on the row below.
  3. **Last row:** the short last row is padded on the right.
  4. **Header-only alignment:** `<th style="text-align:right">` over unaligned `<td>`s gives no alignment, and a table with no data rows gives none.
  5. **Exceptions:** a short first row in `<thead>`, or one with `<th>` cells, is still padded on the right.
  6. **Unchanged behavior:** the existing `chrome-partial.html` and `thead-table.html` expectations still hold. They're also re-run in `test_html_tables.ts`.

## Verification Plan

### Automated Tests
`npm test` type-checks, builds `main.js` and runs every `scratch/test_*.ts`. It picks up the new `scratch/test_chrome_copies.ts` automatically.
1. The new script's checks above all pass.
2. The existing 101 checks still pass, as regression checks. `test_html_tables.ts` matters most here, since it covers alignment and spans.

### Manual Verification
Run in the isolated Obsidian 1.14.5 test instance with this build, using real Chrome copies as before. Save the clipboard first and restore it afterwards.
1. **Whole table (case A):** in Chrome, copy the whole "List of tallest buildings" table on Wikipedia and paste it into a note. The name column should be left-aligned and the height columns right-aligned, with no centered columns.
2. **Partial selection (case B):** select from partway through one row's text to partway through a row a few rows down, copy, and paste. The first row's cells should line up under the same columns as the rows below, with empty cells at its start.
3. **Mixed content (case C):** copy a paragraph, a table and a paragraph together. The text around the table should still match Obsidian's own paste, and no column should be centered unless every data cell in it is.
4. **GitHub (case E):** copy this repo's README table from GitHub. It should still paste with pipes in inline code escaped.
