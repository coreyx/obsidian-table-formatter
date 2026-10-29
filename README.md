# Table Formatter for Obsidian

Paste tables into Obsidian and get clean Markdown tables, whatever they were copied from:

- **Web pages**: Wikipedia, documentation sites, GitHub, chat apps, anything with an HTML `<table>`.
- **Spreadsheets and documents**: Google Sheets, Excel, Word and anything else that copies cells as an HTML table, plus apps that copy cells as tab-separated text.
- **Terminals and CLI tools**: box-drawing tables from Claude Code and other agents, Rich, MySQL, psql, prettytable and tabulate.

The plugin only acts while you paste into Obsidian. It never touches your clipboard, so copying keeps working exactly as before in every other app. Pastes without a table go through Obsidian's normal paste unchanged.

## What it does

### HTML tables

Obsidian's built-in HTML conversion only produces a Markdown table when the copied table already has a simple shape. Otherwise you get raw HTML or a broken table. This plugin converts the tables itself and leaves the rest of the paste to Obsidian's own converter. Text, links and lists around a table come out exactly as they normally would.

For each table:

- **Header row**: taken from `<thead>`, or from leading rows of `<th>` cells. If there's neither, the first row becomes the header. Spreadsheets copy column names that way, as plain cells in the first row.
- **Grouped headers**: a header spread over several rows is combined into one, so "Population" over "2010" and "2020" becomes `Population 2010` and `Population 2020`.
- **Merged cells**: `colspan` and `rowspan` keep their content in the first cell they cover and leave the others empty.
- **Cell content**: links, bold, italics, inline code and images are kept. Line breaks become `<br>`, and `|` is escaped.
- **Alignment**: left, center and right alignment carry over into the table's delimiter row.
- **Captions**: a table's caption is pasted as a line above it.
- **Nested and layout tables**: a table nested in a cell is flattened to text. Tables marked as layout (`role="presentation"`) are left to Obsidian.

Copying three rows from the middle of a web page table:

```html
<table><tbody>
  <tr><td>Mercury</td><td>0</td></tr>
  <tr><td>Venus</td><td>0</td></tr>
  <tr><td>Earth</td><td>1</td></tr>
</tbody></table>
```

pastes as:

```markdown
| Mercury | 0   |
| ------- | --- |
| Venus   | 0   |
| Earth   | 1   |
```

### ASCII tables

Tables drawn with text characters are converted when you paste them as plain text, for example from a terminal. They are also converted when copied from a code block on a web page.

```text
┌───────────┬─────────────────────────┐
│ Option    │ Description             │
├───────────┼─────────────────────────┤
│ --verbose │ Print every step as it  │
│           │ runs                    │
├───────────┼─────────────────────────┤
│ --limit   │ Maximum number of items │
└───────────┴─────────────────────────┘
```

pastes as:

```markdown
| Option    | Description                 |
| --------- | --------------------------- |
| --verbose | Print every step as it runs |
| --limit   | Maximum number of items     |
```

Supported layouts:

| Layout | Looks like | Printed by |
| --- | --- | --- |
| Box drawing: light, heavy, double, rounded | `┌──┬──┐ │ ├──┼──┤` | Claude Code and other agents, Rich, many CLIs |
| `+---+` grid | `+----+----+` and `\| a \| b \|` | MySQL, prettytable, tabulate (`grid`) |
| psql | `a \| b` over `---+---` | PostgreSQL's `psql` |

Text around a table is kept as it was. When rows are separated by rules, a cell that wraps over several lines becomes one cell, and its lines are joined with spaces, since terminals wrap text to fit the column. A line that starts a list item (`- `, `* `, `• `, `1. `) goes on a new line within the cell instead (`<br>`), so lists stay one item per line. Wide characters such as CJK text are measured the way terminals measure them, so columns stay aligned.

**Not converted:**
- Columns lined up with spaces only, as in `docker ps` or `kubectl get` output. These can't be told apart reliably from ordinary aligned text.
- A single box with no columns.
- Tables that are already Markdown.

### Tab-separated spreadsheet data

Some spreadsheet and table apps copy cells only as tab-separated text, with no HTML table. When a paste is nothing but tab-separated rows, it becomes a Markdown table with the first row as its header. Cells that Excel and Google Sheets write in quotes, because they hold a line break or tab, are read correctly, and their line breaks become `<br>`.

To keep ordinary text from being turned into a table, a paste only counts as spreadsheet data when:

- the clipboard has no HTML at all, so code copied from an editor like VS Code, which also copies HTML, isn't converted;
- it has at least two rows and two columns, with the same number of columns on every row;
- not every row starts with a tab, which would be indentation.

Comma-separated text isn't converted.

## Pasting without conversion

Use **paste as plain text** (Ctrl+Shift+V, or Cmd+Shift+V on macOS) to paste the clipboard's raw text without any conversion.

## Settings

Settings → Community plugins → Table Formatter:

- **Convert HTML tables**: on by default. This also follows Obsidian's own Settings → Editor → **Convert pasted HTML to Markdown**. When that's off, Obsidian pastes plain text, and HTML tables are left alone to match.
- **Convert ASCII tables**: on by default. This works whatever Obsidian's HTML setting is.
- **Convert tab-separated data**: on by default. Turn it off if tab-aligned text you paste is being mistaken for a table.

## Installing

The plugin isn't in the community plugin directory yet. It works on desktop and mobile.

### With BRAT (recommended)

[BRAT](https://github.com/TfTHacker/obsidian42-brat) installs plugins straight from their GitHub releases and keeps them updated.

1. In Obsidian, open Settings → Community plugins → Browse, then search for **BRAT** ("Obsidian42 - BRAT"). Install and enable it.
2. Open Settings → BRAT and click **Add beta plugin**.
3. Enter `coreyx/obsidian-table-formatter` (or `https://github.com/coreyx/obsidian-table-formatter`), leave the version on the latest release, and tick **Enable after installing the plugin**. Then click **Add plugin**.
4. If you didn't tick that box, enable **Table Formatter** under Settings → Community plugins.

BRAT checks for new releases when Obsidian starts. To update straight away, run **BRAT: Check for updates to all beta plugins and UPDATE** from the command palette.

### By hand

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/coreyx/obsidian-table-formatter/releases/latest), or build them yourself (see below).
2. Create the folder `<vault>/.obsidian/plugins/table-formatter/` and copy both files into it.
3. In Obsidian, open Settings → Community plugins, reload the list, and enable **Table Formatter**.

## Building from source

Requires Node.js 22.18 or later.

```sh
npm install
npm run build   # type-checks and writes main.js
npm run dev     # rebuilds on every change
npm test        # builds, then runs the regression scripts in scratch/
```

## License

[MIT](LICENSE)
