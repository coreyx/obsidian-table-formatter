import type { TableGrid } from './table-model.ts';

/** Characters that separate cells on a content line. */
const VERTICAL = new Set('|│┃║╎╏┆┇┊┋');

/** Characters that fill border lines between junctions. */
const HORIZONTAL = new Set('-=─━═╌╍┄┅┈┉╴╶╸╺╼╾');

/**
 * Whether a character is a corner, tee or cross: `+`, or anything in the
 * Box Drawing block that isn't a plain horizontal or vertical stroke.
 */
function isJunction(ch: string): boolean {
	if (ch === '+') return true;
	const cp = ch.codePointAt(0) ?? 0;
	return cp >= 0x2500 && cp <= 0x257f && !VERTICAL.has(ch) && !HORIZONTAL.has(ch);
}

/**
 * Terminal display width of one code point: 0 for combining marks and
 * variation selectors, 2 for East Asian wide/fullwidth characters and emoji,
 * 1 otherwise. Terminals pad table columns by this width, so column
 * positions have to be measured in it rather than in characters.
 */
function charWidth(ch: string): number {
	const cp = ch.codePointAt(0) ?? 0;
	if (
		(cp >= 0x0300 && cp <= 0x036f) ||
		(cp >= 0x200b && cp <= 0x200f) ||
		(cp >= 0x20d0 && cp <= 0x20ff) ||
		(cp >= 0xfe00 && cp <= 0xfe0f)
	) {
		return 0;
	}
	if (
		(cp >= 0x1100 && cp <= 0x115f) ||
		(cp >= 0x2e80 && cp <= 0x303e) ||
		(cp >= 0x3041 && cp <= 0x33ff) ||
		(cp >= 0x3400 && cp <= 0x4dbf) ||
		(cp >= 0x4e00 && cp <= 0x9fff) ||
		(cp >= 0xa000 && cp <= 0xa4cf) ||
		(cp >= 0xac00 && cp <= 0xd7a3) ||
		(cp >= 0xf900 && cp <= 0xfaff) ||
		(cp >= 0xfe30 && cp <= 0xfe4f) ||
		(cp >= 0xff00 && cp <= 0xff60) ||
		(cp >= 0xffe0 && cp <= 0xffe6) ||
		(cp >= 0x1f300 && cp <= 0x1f64f) ||
		(cp >= 0x1f680 && cp <= 0x1f6ff) ||
		(cp >= 0x1f900 && cp <= 0x1f9ff) ||
		(cp >= 0x20000 && cp <= 0x3fffd)
	) {
		return 2;
	}
	return 1;
}

/** A character of a line, with the terminal column it starts at. */
interface PlacedChar {
	ch: string;
	col: number;
}

/**
 * Splits a line into characters tagged with their display column.
 */
function place(line: string): PlacedChar[] {
	const placed: PlacedChar[] = [];
	let col = 0;
	for (const ch of line) {
		placed.push({ ch, col });
		col += charWidth(ch);
	}
	return placed;
}

/**
 * A border line: only strokes and junctions, with at least one horizontal
 * stroke and something else (a corner, tee or bar) to mark columns.
 * `+-----+-----+`, `├─────┼─────┤` and `╞═════╪═════╡` all qualify.
 */
export function isBorderLine(line: string): boolean {
	const text = line.trim();
	if (!text) return false;
	let horizontal = false;
	let marker = false;
	for (const ch of text) {
		if (HORIZONTAL.has(ch)) horizontal = true;
		else if (VERTICAL.has(ch) || isJunction(ch)) marker = true;
		else return false;
	}
	return horizontal && marker;
}

/**
 * A content line: starts and ends with a cell separator, e.g. `│ a │ b │`.
 */
export function isContentLine(line: string): boolean {
	const text = line.trim();
	return text.length >= 2 && VERTICAL.has(text[0] ?? '') && VERTICAL.has(text[text.length - 1] ?? '') && !isBorderLine(text);
}

/**
 * Whether a border line is really a Markdown delimiter row (`|---|---|`):
 * no `+` and no box-drawing junction anywhere. Markdown tables already
 * render, so they're left alone.
 */
function isMarkdownDelimiter(line: string): boolean {
	return !Array.from(line.trim()).some(isJunction) && !Array.from(line).some((ch) => ch !== '|' && VERTICAL.has(ch));
}

/**
 * Display columns of the junctions and bars on a border line: the column
 * boundaries every content line should have a separator at.
 */
function boundariesOf(border: string): number[] {
	return place(border)
		.filter(({ ch }) => VERTICAL.has(ch) || isJunction(ch))
		.map(({ col }) => col);
}

/**
 * Cuts a content line at the given display columns, provided a separator
 * sits at every one of them; this keeps a `|` inside a cell from splitting it.
 *
 * @returns The cells, or `null` if the line doesn't line up.
 */
function splitAtBoundaries(line: string, boundaries: number[]): string[] | null {
	const placed = place(line);
	const at = new Map(placed.map((p, i) => [p.col, i]));
	const indexes: number[] = [];
	for (const col of boundaries) {
		const i = at.get(col);
		if (i === undefined || !VERTICAL.has(placed[i]?.ch ?? '')) return null;
		indexes.push(i);
	}
	const cells: string[] = [];
	for (let k = 0; k + 1 < indexes.length; k++) {
		cells.push(
			placed
				.slice((indexes[k] ?? 0) + 1, indexes[k + 1])
				.map((p) => p.ch)
				.join(''),
		);
	}
	return cells;
}

/**
 * Cuts a content line at every separator character, for lines whose wide
 * characters or uneven padding defeat {@link splitAtBoundaries}. A `\|` is
 * kept as text.
 */
function splitOnBars(line: string): string[] {
	const cells: string[] = [];
	let current = '';
	let previous = '';
	for (const ch of line.trim()) {
		if (VERTICAL.has(ch) && previous !== '\\') {
			cells.push(current);
			current = '';
		} else {
			current += ch;
		}
		previous = ch;
	}
	cells.push(current);
	// The line starts and ends with a bar, leaving an empty piece at each end.
	return cells.slice(1, -1);
}

/**
 * Joins one row's worth of content lines into a single row. Each cell's
 * pieces are trimmed, empty pieces dropped, and the rest joined with a line
 * break, which the renderer turns into `<br>`.
 */
function mergeLines(lines: string[][]): string[] {
	const columns = Math.max(0, ...lines.map((cells) => cells.length));
	return Array.from({ length: columns }, (_, i) =>
		lines
			.map((cells) => (cells[i] ?? '').trim())
			.filter(Boolean)
			.join('\n'),
	);
}

/**
 * Removes the indent all non-empty lines share, plus trailing whitespace, so
 * column positions line up from the first character of the table.
 */
export function dedent(lines: string[]): string[] {
	const trimmed = lines.map((line) => line.replace(/\s+$/, ''));
	const indents = trimmed.filter(Boolean).map((line) => /^ */.exec(line)?.[0].length ?? 0);
	const indent = Math.min(...indents);
	return trimmed.map((line) => line.slice(Number.isFinite(indent) ? indent : 0));
}

/**
 * Parses a bordered ASCII or box-drawing table: MySQL/prettytable/tabulate
 * `+---+` grids, and tables drawn with box-drawing characters (light, heavy,
 * double or rounded) as printed by Claude Code, Rich and similar tools.
 *
 * - Column boundaries come from the junctions on border lines; lines that
 *   don't line up with them fall back to splitting on the bars.
 * - Border lines split the content into groups. The first group is the
 *   header when any border follows it; otherwise the first line is promoted.
 * - When borders also separate the data rows, each group is one row and its
 *   lines are joined with line breaks; otherwise each line is a row.
 *
 * @param lines - The table's lines, every one a border or content line.
 * @returns The grid, or `null` when the lines aren't a consistent table with
 *   at least two columns, or are a Markdown table already.
 */
export function parseAsciiTable(lines: string[]): TableGrid | null {
	const table = dedent(lines).filter((line) => line !== '');
	if (table.length === 0) return null;
	if (!table.every((line) => isBorderLine(line) || isContentLine(line))) return null;

	const borders = table.filter(isBorderLine);
	const contentLines = table.filter(isContentLine);
	if (contentLines.length === 0) return null;
	// Only box-drawing bars may go without a border line; bare `| a | b |`
	// lines are too likely to be something else.
	if (borders.length === 0 && contentLines.some((line) => line.includes('|'))) return null;
	if (borders.some(isMarkdownDelimiter)) return null;

	const boundaries = borders.length ? boundariesOf(borders[0] ?? '') : [];
	const expected = boundaries.length ? boundaries.length - 1 : splitOnBars(contentLines[0] ?? '').length;
	if (expected < 2) return null;

	// Group content lines between borders, splitting each into cells.
	const groups: string[][][] = [[]];
	for (const line of table) {
		if (isBorderLine(line)) {
			if ((groups[groups.length - 1] ?? []).length) groups.push([]);
			continue;
		}
		const cells = (boundaries.length && splitAtBoundaries(line, boundaries)) || splitOnBars(line);
		if (cells.length !== expected) return null;
		groups[groups.length - 1]?.push(cells);
	}
	const filled = groups.filter((g) => g.length > 0);

	// A header exists when a border separates the first group from the rest.
	const hasHeader = filled.length >= 2;
	const headerGroup = hasHeader ? (filled[0] ?? []) : (filled[0] ?? []).slice(0, 1);
	const bodyGroups = hasHeader ? filled.slice(1) : [(filled[0] ?? []).slice(1)];
	const rowPerGroup = bodyGroups.length > 1;
	const rows = rowPerGroup ? bodyGroups.map(mergeLines) : (bodyGroups[0] ?? []).map((cells) => mergeLines([cells]));

	return { header: mergeLines(headerGroup), rows, align: [] };
}
