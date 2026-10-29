# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **HTML tables:** tables copied from web pages, Google Sheets, Excel and documents paste as GFM Markdown tables. The rest of the paste goes through Obsidian's own HTML conversion.
- **How HTML tables are shaped:**
  - The header row comes from `<thead>` or leading `<th>` rows, otherwise the first row is promoted; a header spread over several rows is combined into one.
  - Merged cells (`colspan`/`rowspan`) expand into empty cells.
  - Links, formatting, images and inline code inside cells are kept, and alignment carries over.
  - Captions are pasted as a line above the table, and nested tables are flattened to text.
- **ASCII tables:** box-drawing tables (light, heavy, double, rounded), `+---+` grids (MySQL, prettytable, tabulate) and psql output paste as Markdown tables, from plain text or from a `<pre>` block in pasted HTML. Wide characters keep their columns.
- **Paste as plain text** (Ctrl/Cmd+Shift+V) skips conversion.
- **Settings:** a toggle each for HTML and ASCII table conversion. HTML conversion also follows Obsidian's "Convert pasted HTML to Markdown" setting.
