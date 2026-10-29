# Walkthrough: Fix column alignment and partial selections in Chrome copies

Fixed the two bugs that real Chrome copies exposed in the HTML path. Columns are no longer all centered, because alignment now comes from a column's data cells only. When a selection starts partway through a row, that row's cells now stay in the columns they came from.

## What Was Implemented

### 1. HTML tables
- **`src/html-tables.ts`**
  - **`columnAlignment()`** now reads only the data rows. A column gets the alignment all its data cells share, otherwise none. Header cells are ignored, since Chrome writes their default `center` into every copy. The `headerRows` parameter is gone.
  - **`isPartialFirstRow()`** (new) decides when a short first row is the tail of a partially selected row: the table has more than one row, no `<thead>`, and no `<th>` cells in the first row.
  - **`buildGrid()`** takes a `firstRowOffset`, the column where the first row's first cell goes.
  - **`htmlTableToGrid()`** builds the grid once. If the first row is short and `isPartialFirstRow()` holds, it rebuilds with the offset, so rowspans from that row also land in the shifted columns.

### 2. Tests
- **`scratch/fixtures/chrome-whole-table.html`** (new): a synthetic whole-table copy in Chrome's format, with inline computed styles, a grouped header of centered `<th>` cells, and left, right and mixed data columns.
- **`scratch/fixtures/chrome-mid-row.html`** (new): a synthetic partial copy. Its first row is missing two cells and has a `rowspan`, and its last row is cut short.
- **`scratch/test_chrome_copies.ts`** (new): 14 checks, listed below.

### 3. Documentation
- **`README.md`**: the alignment bullet now describes the data-cell rule, and a new bullet covers partial selections.
- **`CHANGELOG.md`**: both fixes are listed under `Fixed` in `[Unreleased]`.

## Verification & Test Results

### Automated Tests
Ran `npm test` (type-check, build, then every scratch script). `scratch/test_chrome_copies.ts` has 14 checks, and all **passed**:
- **Whole-table fixture:** the delimiter row is `:---` / `---:` / `---:` / `---`. That's left, right, right, and none for the mixed column, with nothing centered: **Passed**.
- **Mid-row fixture:**
  - The first row is padded on the left: **Passed**.
  - The rowspan covers the shifted column on the next row: **Passed**.
  - The short last row is padded on the right: **Passed**.
  - Alignment comes from the data cells: **Passed**.
- **Alignment edge cases:** alignment set only on header cells is ignored, a table with no data rows gets none, and disagreeing data cells give none: **Passed**.
- **Real headers:** a short first row in `<thead>`, or one with `<th>` cells, is still padded on the right, and a single short row is left alone: **Passed**.
- **Existing fixtures:** `chrome-partial.html` and `thead-table.html` give the same output as before, and the mid-row clipboard document converts through `convertHtmlPaste()`: **Passed**.

### Regression Testing
All six scratch scripts passed on the final run:
- `test_ascii_tables.ts` (33)
- `test_chrome_copies.ts` (14)
- `test_html_tables.ts` (16)
- `test_plugin.ts` (25)
- `test_table_model.ts` (14)
- `test_tsv_tables.ts` (13)

That's 115 checks. The existing HTML expectations needed no changes, and the build reported no errors.

## Manual Verification
Steps from the plan, for anyone repeating them: install a build with this change, then copy each case in Chrome and paste it into a note with Ctrl+V.
1. **Whole table:** copy the whole "List of tallest buildings" table on Wikipedia. No column should be centered.
2. **Partial selection:** select from partway through one row's text to partway through a row a few rows down. The first row should line up under the same columns as the rows below, with empty cells at its start.
3. **Mixed content:** copy a paragraph, a table and a paragraph together. The text around the table should match Obsidian's own paste, and no column should be centered.
4. **GitHub:** copy this repo's README table. Pipes in inline code should stay escaped.

### Results (2026-10-29)
Run by Claude in an isolated Obsidian 1.14.5 instance with this build. Each case used a real Chrome copy and a real Ctrl+V, and was compared against Obsidian's own paste with the plugin turned off. The user's clipboard was saved first and restored afterwards.

| Case | Result |
| --- | --- |
| 1. Whole table | **Passed.** 99 rows of 11 cells, one combined header, no centered columns. Name is left-aligned. The height columns have no alignment because their data cells mix right and center alignment on that page. Obsidian's own paste splits the grouped header over two rows. |
| 2. Partial selection | **Passed.** The first row starts with an empty Rank cell and its cells line up with the rows below. The short last row is padded on the right, and the height columns are right-aligned. Before this fix, the first row was shifted one column left. |
| 3. Mixed content | **Passed.** The text around the table is identical to Obsidian's own paste, every row has 6 cells, and no column is centered. Before this fix, every column was centered. |
| 4. GitHub | **Passed.** Pipes inside inline code are escaped, and nothing is aligned, matching the source. |

During case 1, the clipboard changed between the plugin paste and the comparison paste, because the user copied something at the same time. The checks were paused, the user's clipboard was saved again, and case 1 was rerun. The results above are from that rerun.

## Follow-ups
- **A partially selected first row is still the header.** It's a data row, promoted to the header as with any table that has no header markup. Obsidian's own paste puts an empty header above it instead. Out of scope here.
- **A table whose first row genuinely leaves out its leading cells,** with no `<thead>` or `<th>`, will now be padded on the left. No real example of this has turned up.
