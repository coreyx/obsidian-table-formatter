import type { Align, TableGrid } from './table-model.ts';

/**
 * Converts one table cell's contents to Markdown. In the plugin this wraps
 * Obsidian's `htmlToMarkdown()`; tests inject a stand-in.
 */
export type CellToMarkdown = (content: HTMLElement) => string;

/** One position in the expanded grid. */
interface GridSlot {
	/** The `<td>`/`<th>` that owns this position. */
	cell: Element;
	/** Converted Markdown of the owning cell. */
	markdown: string;
	/** False for positions only covered by another cell's colspan/rowspan. */
	isOrigin: boolean;
}

/**
 * Upper bound on spans: some pages emit `colspan="1000"` to mean "the rest of
 * the row", and honoring that literally would create thousands of columns.
 */
const MAX_SPAN = 100;

/**
 * Reads a span attribute the way browsers do: missing, invalid or zero values
 * become 1, and anything above {@link MAX_SPAN} is clamped.
 */
function readSpan(cell: Element, attr: 'colspan' | 'rowspan'): number {
	const value = parseInt(cell.getAttribute(attr) ?? '', 10);
	if (!Number.isFinite(value) || value < 1) return 1;
	return Math.min(value, MAX_SPAN);
}

/**
 * Returns the `<td>`/`<th>` children of a row.
 */
function cellsOf(row: Element): Element[] {
	return Array.from(row.children).filter((el) => el.tagName === 'TD' || el.tagName === 'TH');
}

/**
 * Collects a table's own rows (never a nested table's) in display order:
 * `<thead>` rows first, then body rows in source order, then `<tfoot>` rows,
 * because browsers render a `<tfoot>` last wherever it appears in the source.
 *
 * @returns The rows plus how many leading rows came from `<thead>`.
 */
function collectRows(table: Element): { rows: Element[]; theadCount: number } {
	const head: Element[] = [];
	const body: Element[] = [];
	const foot: Element[] = [];
	for (const child of Array.from(table.children)) {
		const rowsIn = (section: Element): Element[] => Array.from(section.children).filter((el) => el.tagName === 'TR');
		switch (child.tagName) {
			case 'THEAD':
				head.push(...rowsIn(child));
				break;
			case 'TBODY':
				body.push(...rowsIn(child));
				break;
			case 'TFOOT':
				foot.push(...rowsIn(child));
				break;
			case 'TR':
				body.push(child);
				break;
		}
	}
	const rows = [...head, ...body, ...foot].filter((row) => cellsOf(row).length > 0);
	const theadCount = head.filter((row) => cellsOf(row).length > 0).length;
	return { rows, theadCount };
}

/**
 * Replaces each table nested inside a cell with its text: cells joined by a
 * space and rows by `<br>`, since GFM cells can't hold a table.
 */
function flattenNestedTables(content: HTMLElement): void {
	const doc = content.ownerDocument;
	for (const nested of Array.from(content.querySelectorAll('table'))) {
		// An inner table already removed with an outer one is skipped.
		if (!content.contains(nested)) continue;
		const replacement = doc.createElement('span');
		const lines = Array.from(nested.querySelectorAll('tr'))
			.map((row) => cellsOf(row).map((c) => (c.textContent ?? '').trim()).filter(Boolean).join(' '))
			.filter(Boolean);
		lines.forEach((line, i) => {
			if (i > 0) replacement.appendChild(doc.createElement('br'));
			replacement.appendChild(doc.createTextNode(line));
		});
		nested.replaceWith(replacement);
	}
}

/**
 * Converts a cell's contents to Markdown. The children are moved into a
 * `<div>` first so the converter never sees a bare `<td>`, which Obsidian's
 * own table rules would render as a pipe-delimited fragment.
 */
function cellMarkdown(cell: Element, cellToMarkdown: CellToMarkdown): string {
	const content = cell.ownerDocument.createElement('div');
	for (const child of Array.from(cell.cloneNode(true).childNodes)) content.appendChild(child);
	flattenNestedTables(content);
	return cellToMarkdown(content);
}

/**
 * Reads a cell's horizontal alignment from its `align` attribute or an inline
 * `text-align` style. `justify` and anything unrecognized count as none.
 */
function readAlign(cell: Element): Align {
	const style = cell.getAttribute('style') ?? '';
	const fromStyle = /(?:^|;)\s*text-align\s*:\s*([a-z]+)/i.exec(style)?.[1];
	const value = (fromStyle ?? cell.getAttribute('align') ?? '').toLowerCase();
	return value === 'left' || value === 'center' || value === 'right' ? value : null;
}

/**
 * Lays the table's cells out on a rectangular grid, expanding colspan and
 * rowspan so every row has a slot for every column it covers.
 */
function buildGrid(rows: Element[], cellToMarkdown: CellToMarkdown): GridSlot[][] {
	const grid: GridSlot[][] = rows.map(() => []);
	rows.forEach((row, r) => {
		let c = 0;
		for (const cell of cellsOf(row)) {
			const line = grid[r] ?? [];
			while (line[c]) c++;
			const markdown = cellMarkdown(cell, cellToMarkdown);
			const colspan = readSpan(cell, 'colspan');
			// A rowspan can't reach past the table's last row.
			const rowspan = Math.min(readSpan(cell, 'rowspan'), rows.length - r);
			for (let dr = 0; dr < rowspan; dr++) {
				const target = grid[r + dr];
				if (!target) continue;
				for (let dc = 0; dc < colspan; dc++) {
					if (target[c + dc]) continue;
					target[c + dc] = { cell, markdown, isOrigin: dr === 0 && dc === 0 };
				}
			}
			c += colspan;
		}
	});
	return grid;
}

/**
 * Decides how many leading rows form the header: every `<thead>` row if there
 * is a `<thead>`, otherwise every leading row made entirely of `<th>` cells,
 * otherwise just the first row (promoted, which suits spreadsheet copies that
 * put column names in plain `<td>` cells).
 */
function headerRowCount(rows: Element[], theadCount: number): number {
	if (theadCount > 0) return theadCount;
	let count = 0;
	while (count < rows.length && cellsOf(rows[count] as Element).every((c) => c.tagName === 'TH')) count++;
	return Math.max(count, Math.min(1, rows.length));
}

/**
 * Builds the single GFM header row. With one header row, covered positions
 * stay empty like everywhere else. With several (a grouped header such as
 * "Population" spanning "2010" and "2020"), each column's labels are stacked
 * into one, repeating spanning labels so every column reads on its own:
 * "Population 2010", "Population 2020".
 */
function combineHeader(headerRows: GridSlot[][], columns: number): string[] {
	if (headerRows.length === 1) {
		const row = headerRows[0] ?? [];
		return Array.from({ length: columns }, (_, i) => (row[i]?.isOrigin ? row[i]?.markdown ?? '' : ''));
	}
	return Array.from({ length: columns }, (_, i) => {
		const parts: string[] = [];
		for (const row of headerRows) {
			const label = row[i]?.markdown.trim() ?? '';
			if (label && parts[parts.length - 1] !== label) parts.push(label);
		}
		return parts.join(' ');
	});
}

/**
 * Picks each column's alignment from the header cell; when the header says
 * nothing, uses the body cells' alignment if they all agree, since many pages
 * right-align numeric columns only on the data cells.
 */
function columnAlignment(headerRows: GridSlot[][], bodyRows: GridSlot[][], columns: number): Align[] {
	const lastHeader = headerRows[headerRows.length - 1] ?? [];
	return Array.from({ length: columns }, (_, i) => {
		const headerSlot = lastHeader[i];
		const fromHeader = headerSlot ? readAlign(headerSlot.cell) : null;
		if (fromHeader) return fromHeader;
		const bodyAligns = bodyRows.map((row) => row[i]).filter((slot) => slot?.isOrigin).map((slot) => readAlign((slot as GridSlot).cell));
		const first = bodyAligns[0] ?? null;
		return first && bodyAligns.every((a) => a === first) ? first : null;
	});
}

/**
 * Converts an HTML table into a {@link TableGrid}.
 *
 * - colspan/rowspan are expanded; a spanning cell's content sits in its first
 *   position and the positions it covers are left empty.
 * - The header comes from `<thead>`, else leading all-`<th>` rows, else the
 *   first row; several header rows are combined into one.
 * - Tables nested in cells are flattened to text.
 *
 * @param table - The `<table>` element.
 * @param cellToMarkdown - Converts a cell's contents to Markdown.
 * @returns The grid; it has no columns when the table has no cells.
 */
export function htmlTableToGrid(table: Element, cellToMarkdown: CellToMarkdown): TableGrid {
	const { rows, theadCount } = collectRows(table);
	const grid = buildGrid(rows, cellToMarkdown);
	const columns = Math.max(0, ...grid.map((row) => row.length));
	const headerCount = headerRowCount(rows, theadCount);
	const headerRows = grid.slice(0, headerCount);
	const bodyRows = grid.slice(headerCount);

	return {
		header: headerRows.length ? combineHeader(headerRows, columns) : [],
		rows: bodyRows.map((row) => Array.from({ length: columns }, (_, i) => (row[i]?.isOrigin ? row[i]?.markdown ?? '' : ''))),
		align: columnAlignment(headerRows, bodyRows, columns),
	};
}
