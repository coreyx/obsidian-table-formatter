// Regression checks for src/html-tables.ts (spec/obsidian-table-paste, TASK-4 and TASK-5).
// Fixtures are synthetic: they copy the markup structure of real sources, not their content.
import { readFileSync } from 'node:fs';
import { check, finish } from './harness.ts';
import { htmlToMarkdown, parse } from './dom.ts';
import { htmlTableToGrid } from '../src/html-tables.ts';
import { renderGfmTable } from '../src/table-model.ts';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** Parses `html`, converts its first table, and renders the grid as Markdown lines. */
function tableLines(html: string): string[] {
	const table = parse(html).querySelector('table');
	if (!table) throw new Error('fixture has no table');
	// Padding is cosmetic, so compare with runs of spaces and dashes collapsed.
	return renderGfmTable(htmlTableToGrid(table, htmlToMarkdown))
		.split('\n')
		.map((line) => line.replace(/ {2,}/g, ' ').replace(/-+/g, '---'));
}

// 1. A table with <thead>/<th>.
check('thead table', tableLines(fixture('thead-table.html')), [
	'| Planet | Moons | Ring system |',
	'| --- | ---: | --- |',
	'| Mercury | 0 | No |',
	'| Saturn | 146 | Yes |',
]);

// 2. Google Sheets style: every cell is a <td>, so the first row is promoted.
check('sheets-style table promotes first row', tableLines(fixture('sheets-table.html')), [
	'| Item | Qty | Price |',
	'| --- | --- | --- |',
	'| Widget | 4 | 2.50 |',
	'| Gadget | 10 | 1.25 |',
]);

// 3. colspan and rowspan expand to empty cells; the grouped header is combined.
check('spans expand and grouped header combines', tableLines(fixture('spans-table.html')), [
	'| Region | Population 2010 | Population 2020 |',
	'| --- | --- | --- |',
	'| North | 100 | 120 |',
	'| | 90 | 95 |',
	'| Total | 190 | |',
]);

// 4. Inline formatting inside cells survives; pipes are escaped, even in code.
check('inline formatting kept', tableLines(fixture('inline-table.html')), [
	'| Name | Notes |',
	'| --- | --- |',
	'| [Example](https://example.com/docs) | **bold** and *italic* |',
	'| `a\\|b` | ![chart](https://example.com/chart.png) |',
	'| line one<br>line two | first<br>second |',
]);

// 5. A nested table is flattened into its cell.
check('nested table flattened', tableLines(
	'<table><tr><th>Outer</th><th>Detail</th></tr><tr><td>x</td><td><table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table></td></tr></table>',
), [
	'| Outer | Detail |',
	'| --- | --- |',
	'| x | a b<br>c d |',
]);

// 9. A partial Chrome selection: a fragment with <tbody> and no header markup.
check('partial chrome selection', tableLines(fixture('chrome-partial.html')), [
	'| Saturn | 146 | Yes |',
	'| --- | ---: | --- |',
	'| Uranus | 28 | Yes |',
]);

// Header given by leading all-<th> rows inside <tbody> (common on wikis), with a row-header column.
check('th rows in tbody become header; row headers stay body', tableLines(
	'<table><tbody><tr><th>Name</th><th>Score</th></tr><tr><th>Ana</th><td>7</td></tr></tbody></table>',
), [
	'| Name | Score |',
	'| --- | --- |',
	'| Ana | 7 |',
]);

finish();
