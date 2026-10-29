---
status: approved
---

# Join wrapped ASCII table cells with spaces instead of line breaks

In 0.1.0, when a cell in a terminal table wraps over several lines, the lines are joined with `<br>`. Terminals and tools like Claude Code wrap long text to fit the column width, so those breaks are almost always just wrapping, not real line breaks. This change joins the lines with a space, so a wrapped sentence pastes as one sentence. A line that starts with a list marker keeps its `<br>`, so lists inside cells still read as lists.

**Related documents**
- [Table paste plan](../obsidian-table-paste/implementation_plan.md)

## User Review Required

> [!IMPORTANT]
> **This changes behavior that shipped in 0.1.0.** Any ASCII table with a wrapped cell will paste differently: `Print every step as it runs` instead of `Print every step as it<br>runs`. HTML tables aren't affected; real line breaks in HTML cells still become `<br>`.

> [!NOTE]
> **What counts as a list marker:** the next piece of the cell starts with `- `, `* `, `+ `, `• `, or a number followed by `.` or `)` and a space, such as `1. ` or `2) `.
> - A word broken mid-word with no hyphen (a long URL, say) gets a space in the middle either way. There's no reliable way to tell those breaks apart from ordinary wrapping.
> - Header cells follow the same rule.

## Open Questions

None at this time.

## Proposed Changes

### ASCII tables

#### [MODIFY] `src/ascii-tables.ts`
- [x] **TASK-1:** Change `mergeLines()` so it joins a cell's pieces with a single space, and with `\n` (rendered as `<br>`) only before a piece that starts with a list marker.
  - Add a `LIST_ITEM` pattern: `/^(?:[-*+•]|\d+[.)])\s/`.
  - Update the doc comments on `mergeLines()` and `parseAsciiTable()` to describe the new rule and why: terminal wrapping isn't meaningful.

### Documentation

#### [MODIFY] `README.md`
- [ ] **TASK-2:** Update the ASCII example's output to `Print every step as it runs`. Reword the sentence about wrapped cells to describe the new rule, including the list-marker exception.

## Verification Plan

### Automated Tests
Update `scratch/test_ascii_tables.ts` and run `npm test`:
1. The Claude Code fixture's wrapped description becomes `Print every step as it runs`.
2. A cell wrapped over three lines joins into one line with single spaces.
3. A cell whose pieces are `- one` and `- two` becomes `- one<br>- two`; the same for `1. one` / `2. two`.
4. A wrapped header cell joins with a space.
5. All existing checks in the four scratch scripts still pass.

### Manual Verification
1. With the updated plugin installed, ask Claude Code for a table with a long description column in a narrow terminal, so at least one cell wraps.
2. Copy the table from the terminal and paste it into a note.
3. The wrapped cell should read as one continuous sentence in Reading view, with no line break in the middle.
