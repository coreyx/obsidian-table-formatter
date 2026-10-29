// Regression checks for spec/chrome-copy-fixes: column alignment from data cells
// only, and left padding for a partially selected first row.
// Fixtures are synthetic: they copy the markup structure of real Chrome copies, not their content.
import { readFileSync } from 'node:fs';
import { check, finish } from './harness.ts';
import { htmlToMarkdown, parse } from './dom.ts';
import { convertHtmlPaste, htmlTableToGrid } from '../src/html-tables.ts';
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

// 1. Whole-table copy: centered header cells don't center the columns; data cells decide.
check('whole Chrome copy aligns from data cells', tableLines(fixture('chrome-whole-table.html')), [
	'| Building | Height m | Height ft | City |',
	'| :--- | ---: | ---: | --- |',
	'| [Example Spire](https://example.org/wiki/Example_Spire) | 812 | 2,664 | Northport |',
	'| Sample Tower | 640 | 2,100 | Eastvale |',
	'| Placeholder Plaza | 598 | 1,962 | Westbrook |',
]);

// 2 and 3. Mid-row copy: the first row moves to the last columns, its rowspan with it,
// and the short last row is still padded on the right.
const midRow = tableLines(fixture('chrome-mid-row.html'));
check('partial first row padded on the left', midRow[0], '| | | 640 | Eastvale | 2019 |');
check('rowspan from the first row covers the shifted column', midRow[2], '| 3 | Placeholder Plaza | | Westbrook | 2017 |');
check('short last row padded on the right', midRow[3], '| 4 | Demo Cent | | | |');
check('mid-row copy alignment from data cells', midRow[1], '| ---: | :--- | --- | :--- | ---: |');

// 4. Alignment only on header cells is ignored, and a header-only table gets none.
check('header-only alignment ignored', tableLines(
	'<table><tr><th style="text-align: right">Count</th><th align="center">Name</th></tr><tr><td>1</td><td>a</td></tr><tr><td>2</td><td>b</td></tr></table>',
)[1], '| --- | --- |');
check('table with no data rows has no alignment', tableLines(
	'<table><thead><tr><th style="text-align: right">Count</th><th style="text-align: left">Name</th></tr></thead></table>',
), ['| Count | Name |', '| --- | --- |']);
check('disagreeing data cells give no alignment', tableLines(
	'<table><tr><th>N</th></tr><tr><td style="text-align: right">1</td></tr><tr><td style="text-align: left">2</td></tr></table>',
)[1], '| --- |');

// 5. A short first row in <thead>, or one with <th> cells, is a real header: right padding.
check('short <thead> row padded on the right', tableLines(
	'<table><thead><tr><td>A</td><td>B</td></tr></thead><tbody><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>',
)[0], '| A | B | |');
check('short <th> row padded on the right', tableLines(
	'<table><tbody><tr><th>A</th><td>B</td></tr><tr><td>1</td><td>2</td><td>3</td></tr></tbody></table>',
)[0], '| A | B | |');
check('single short row left alone', tableLines('<table><tr><td>A</td><td>B</td></tr></table>'), ['| A | B |', '| --- | --- |']);

// 6. Earlier fixtures are unchanged.
check('chrome-partial fixture unchanged', tableLines(fixture('chrome-partial.html')), [
	'| Saturn | 146 | Yes |',
	'| --- | ---: | --- |',
	'| Uranus | 28 | Yes |',
]);
check('thead fixture keeps right-aligned Moons', tableLines(fixture('thead-table.html'))[1], '| --- | ---: | --- |');

// The whole clipboard document converts through the paste entry point too.
check('mid-row clipboard converts', convertHtmlPaste(fixture('chrome-mid-row.html'), { parse, htmlToMarkdown })?.split('\n').length, 4);

finish();
