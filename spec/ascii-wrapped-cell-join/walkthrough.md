# Walkthrough: Join wrapped ASCII table cells with spaces

When a cell in a terminal table wraps over several lines, its lines are now joined with a space instead of `<br>`, so a wrapped sentence pastes as one sentence. A line that starts a list item still begins a new line within the cell (`<br>`), so lists inside cells stay readable.

## What Was Implemented

### 1. ASCII tables
- **`src/ascii-tables.ts`**: `mergeLines()` joins a cell's pieces with a space, or with a line break before a piece matching the new `LIST_ITEM` pattern (`- `, `* `, `+ `, `• `, `1. `, `2) `). The renderer turns that line break into `<br>`. Header cells follow the same rule. The doc comments on `mergeLines()` and `parseAsciiTable()` explain why: terminal wrapping isn't meaningful.

### 2. Documentation
- **`README.md`**: the ASCII example now shows `Print every step as it runs`, and the paragraph on wrapped cells describes the new rule and the list-item exception. Both README examples were run through the converters and match their actual output.

## Verification & Test Results

### Automated Tests
Ran `npm test` (type-check, build, then all scratch scripts). `scratch/test_ascii_tables.ts` now has 33 checks, all **passed**:
- The Claude Code fixture's wrapped description becomes `Print every step as it runs`: **Passed** (expectation updated from the old `<br>` form).
- A cell wrapped over three lines joins into one line with single spaces: **Passed**.
- `- one` / `- two` becomes `- one<br>- two`, and `1. one` / `2. two` becomes `1. one<br>2. two`: **Passed**.
- A wrapped header cell joins with a space: **Passed**.

### Regression Testing
The other three scripts passed unchanged: `test_html_tables.ts` (16), `test_plugin.ts` (20, run against the rebuilt `main.js`) and `test_table_model.ts` (14). The build reported no errors.

## Manual Verification
1. Install a build with this change (the next release via BRAT, or `npm run build` and copy `main.js` and `manifest.json` into `<vault>/.obsidian/plugins/table-formatter/`).
2. In a narrow terminal, ask Claude Code for a table with a long description column, so at least one cell wraps.
3. Copy the table from the terminal and paste it into a note.
4. In Reading view, the wrapped cell should read as one continuous sentence, with no line break in the middle.

### Results (2026-10-29, run by Claude in Obsidian 1.14.5)
**Passed.** In an isolated Obsidian 1.14.5 instance running the 0.2.0 build, the Claude Code fixture was put on the real clipboard with Windows line endings and pasted with Ctrl+V. The wrapped cell came out as `Print every step as it runs`, with no `<br>`, and Reading view rendered a 4-row table. This used the fixture, not a table copied from a live terminal.

## Follow-ups
- A word broken mid-word with no hyphen, such as a long URL, gets a space where it was broken. That was already broken in 0.1.0 (with `<br>`), and there's no reliable way to tell those breaks from ordinary wrapping.
