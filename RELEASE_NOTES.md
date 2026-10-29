# Release Notes

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
