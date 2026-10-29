import { renderGfmTable } from './table-model.ts';
import type { TableGrid } from './table-model.ts';

/**
 * Splits tab-separated text into rows of fields, reading quoted fields the
 * way Excel and Google Sheets write them: a field that starts with `"` runs
 * to the closing `"`, `""` inside it is a literal quote, and tabs and line
 * breaks inside it belong to the cell.
 *
 * @returns The rows, or `null` if a quote is left unclosed or a closing
 *   quote is followed by anything other than a tab, a line break or the end.
 */
function splitRows(text: string): string[][] | null {
	const rows: string[][] = [];
	let row: string[] = [];
	let i = 0;

	const endOfLine = (at: number): number => (text[at] === '\r' && text[at + 1] === '\n' ? 2 : text[at] === '\n' ? 1 : 0);

	for (;;) {
		let field = '';
		if (text[i] === '"') {
			i++;
			for (;;) {
				if (i >= text.length) return null;
				if (text[i] === '"') {
					if (text[i + 1] === '"') {
						field += '"';
						i += 2;
						continue;
					}
					i++;
					break;
				}
				field += text[i];
				i++;
			}
			if (i < text.length && text[i] !== '\t' && endOfLine(i) === 0) return null;
		} else {
			while (i < text.length && text[i] !== '\t' && endOfLine(i) === 0) {
				field += text[i];
				i++;
			}
		}
		row.push(field);

		if (i >= text.length) {
			rows.push(row);
			return rows;
		}
		if (text[i] === '\t') {
			i++;
			continue;
		}
		i += endOfLine(i);
		rows.push(row);
		row = [];
	}
}

/**
 * Parses a paste that consists entirely of tab-separated rows, as some
 * spreadsheet and table apps copy cells, into a table with the first row as
 * its header.
 *
 * To keep ordinary text from being taken for a table, the paste must have at
 * least two non-empty rows and two columns, the same column count on every
 * row, and not every row starting with a tab (which is tab indentation, as in
 * code). A single trailing line break, which most apps add, is ignored.
 *
 * @param text - The clipboard's `text/plain`.
 * @returns The grid, or `null` if the text isn't tab-separated rows.
 */
export function parseTsv(text: string): TableGrid | null {
	if (!text.includes('\t')) return null;
	const rows = splitRows(text.replace(/\r?\n$/, ''));
	if (!rows) return null;

	const columns = rows[0]?.length ?? 0;
	if (columns < 2 || rows.some((row) => row.length !== columns)) return null;
	if (rows.filter((row) => row.some((field) => field.trim() !== '')).length < 2) return null;
	if (rows.every((row) => row[0] === '')) return null;

	const [header, ...body] = rows;
	return { header: header ?? [], rows: body, align: [] };
}

/**
 * Converts a tab-separated paste to a GFM table.
 *
 * @param text - The clipboard's `text/plain`.
 * @returns The table's Markdown, or `null` if the text isn't tab-separated rows.
 */
export function convertTsvPaste(text: string): string | null {
	const grid = parseTsv(text);
	return grid ? renderGfmTable(grid) : null;
}
