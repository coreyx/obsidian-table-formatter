# Release Notes

## 0.2.1 - 2026-10-29

Two fixes for tables copied from Chrome.

### Columns no longer all come out centered

Chrome copies each table cell along with its styles, and browsers center header cells by default. Table Formatter used to take a column's alignment from its header, so nearly every table copied from Chrome pasted with every column centered. Alignment now comes from a column's data cells instead. A column of right-aligned numbers stays right-aligned, and a column whose cells don't agree gets no alignment.

### Selections that start partway through a row stay lined up

If your selection starts in the middle of a table row, Chrome copies only the rest of that row. That row used to land one or more columns to the left of where it belongs. Its cells now stay in their own columns, with empty cells before them.

### Updating

BRAT picks up this release on its next update check. To update right away, run **BRAT: Check for updates to all beta plugins and UPDATE** from the command palette.

## 0.2.0 - 2026-10-29

### Spreadsheet data copied as plain text

Some spreadsheet and table apps copy cells only as tab-separated text, not as a table. Pasting that into Obsidian now gives you a Markdown table too, with the first row as the header. Cells holding line breaks, which Excel and Google Sheets put in quotes, come through intact.

To keep code and other tab-aligned text from turning into tables by accident, this only happens when the clipboard holds plain text and nothing else, and every row has the same number of columns. If something still converts that shouldn't, paste it with Ctrl+Shift+V (Cmd+Shift+V on macOS), or turn off the new "Convert tab-separated data" setting.

Excel and Google Sheets already worked in 0.1.0, because they also copy cells as a table.

### Wrapped cells in terminal tables read as sentences

When a cell in a terminal table, like the ones Claude Code prints, wraps over several lines, those lines are now joined with spaces. A long description pastes as one sentence instead of being broken where the terminal happened to wrap it. Lines that start a list item still get their own line within the cell.

### Updating

BRAT picks up this release on its next update check. To update right away, run **BRAT: Check for updates to all beta plugins and UPDATE** from the command palette.

## 0.1.0 - 2026-10-29

The first release of Table Formatter. Copy a table from almost anywhere, paste it into Obsidian, and get a clean Markdown table instead of raw HTML or a jumble of characters.

### Tables from the web, spreadsheets and documents

Tables copied from web pages, Google Sheets, Excel or Word now paste as proper Markdown tables. This includes awkward ones: tables with no header row, merged cells, headers spread over several rows, and links or formatting inside cells. Anything you copied around the table pastes exactly as Obsidian normally converts it.

### Tables from terminals and AI agents

Tables drawn with text characters paste as Markdown tables too. That covers the box-drawing tables Claude Code and other agents print, MySQL and psql query results, and the grids that Python's Rich, prettytable and tabulate produce. Long cells that wrap over several lines are put back together, and text before or after the table is left alone.

### Staying out of the way

- Your clipboard is never changed, so copying and pasting into any other app works exactly as before.
- Pastes without a table are untouched.
- To paste the raw text instead, use paste as plain text (Ctrl+Shift+V, or Cmd+Shift+V on macOS).
- Each kind of table can be turned off in the plugin's settings. HTML tables also respect Obsidian's own "Convert pasted HTML to Markdown" setting.

### Installing

This release is meant for testing through [BRAT](https://github.com/TfTHacker/obsidian42-brat): add `coreyx/obsidian-table-formatter` as a beta plugin. See the README for step-by-step instructions, or for installing by hand.
