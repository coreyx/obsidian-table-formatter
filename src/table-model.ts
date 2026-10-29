/**
 * Column alignment as expressed in a GFM table's delimiter row; `null` means
 * no explicit alignment (`---`).
 */
export type Align = 'left' | 'center' | 'right' | null;

/**
 * A source-independent table: the shape both the HTML and the ASCII parsers
 * produce, so a single renderer decides how every pasted table looks.
 *
 * Cell strings are Markdown fragments. They may contain newlines and raw `|`;
 * {@link renderGfmTable} makes them safe for a single table row.
 */
export interface TableGrid {
	/** Header cells. GFM tables always have exactly one header row. */
	header: string[];
	/** Body rows, which may be ragged; the renderer pads them. */
	rows: string[][];
	/** Per-column alignment; missing entries count as `null`. */
	align: Align[];
}

/**
 * Escapes every `|` that is not already escaped, so it can't end a cell early.
 * A pipe counts as escaped only when preceded by an odd number of backslashes.
 *
 * @param text - Cell content.
 * @returns The content with all unescaped pipes written as `\|`.
 */
export function escapePipes(text: string): string {
	let out = '';
	let backslashes = 0;
	for (const ch of text) {
		if (ch === '|' && backslashes % 2 === 0) {
			out += '\\|';
		} else {
			out += ch;
		}
		backslashes = ch === '\\' ? backslashes + 1 : 0;
	}
	return out;
}

/**
 * Turns arbitrary cell content into something that fits on one table row:
 * trims it, folds each run of line breaks (and the whitespace around them)
 * into a single `<br>`, and escapes pipes.
 *
 * @param text - Cell content, possibly multi-line.
 * @returns A single-line, pipe-safe cell.
 */
export function formatCell(text: string): string {
	const singleLine = text
		.replace(/ /g, ' ')
		.trim()
		.replace(/[ \t]*(?:\r?\n[ \t]*)+/g, '<br>');
	return escapePipes(singleLine);
}

/**
 * Display width used for column padding. Counting code points rather than
 * UTF-16 units keeps emoji and astral characters from over-padding; East Asian
 * wide characters may still look misaligned in the editor, which is cosmetic
 * only since GFM ignores padding.
 */
function cellWidth(text: string): number {
	return [...text].length;
}

/**
 * Builds the delimiter cell for one column, as wide as the column.
 */
function delimiterCell(align: Align, width: number): string {
	const w = Math.max(3, width);
	switch (align) {
		case 'left':
			return ':' + '-'.repeat(w - 1);
		case 'right':
			return '-'.repeat(w - 1) + ':';
		case 'center':
			return ':' + '-'.repeat(w - 2) + ':';
		default:
			return '-'.repeat(w);
	}
}

/**
 * Renders a {@link TableGrid} as a GFM pipe table.
 *
 * Every row is padded to the widest row's column count, and every column is
 * padded to its widest cell so the Markdown source stays readable in the
 * editor's Source mode.
 *
 * @param grid - The table to render.
 * @returns The table's Markdown, with no leading or trailing blank lines, or
 *   an empty string when the grid has no cells at all.
 */
export function renderGfmTable(grid: TableGrid): string {
	const columns = Math.max(grid.header.length, ...grid.rows.map((r) => r.length));
	if (columns === 0) return '';

	const pad = (row: string[]): string[] =>
		Array.from({ length: columns }, (_, i) => formatCell(row[i] ?? ''));
	const header = pad(grid.header);
	const rows = grid.rows.map(pad);

	const widths = Array.from({ length: columns }, (_, i) =>
		Math.max(3, cellWidth(header[i] ?? ''), ...rows.map((r) => cellWidth(r[i] ?? ''))),
	);

	const line = (cells: string[]): string =>
		'| ' + cells.map((c, i) => c + ' '.repeat((widths[i] ?? 0) - cellWidth(c))).join(' | ') + ' |';
	const delimiter = '| ' + widths.map((w, i) => delimiterCell(grid.align[i] ?? null, w)).join(' | ') + ' |';

	return [line(header), delimiter, ...rows.map(line)].join('\n');
}
