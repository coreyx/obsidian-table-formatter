// Regression checks for src/tsv-tables.ts (spec/spreadsheet-tsv-paste, TASK-1).
import { check, finish } from './harness.ts';
import { convertTsvPaste } from '../src/tsv-tables.ts';

/** Converts and collapses padding, so expectations don't depend on column widths. */
function table(text: string): string[] | null {
	const md = convertTsvPaste(text);
	if (md === null) return null;
	return md.split('\n').map((line, i) => (i === 1 ? line.replace(/-+/g, '---') : line).replace(/ {2,}/g, ' '));
}

const basic = ['| Item | Qty | Price |', '| --- | --- | --- |', '| Widget | 4 | 2.50 |', '| Gadget | 10 | 1.25 |'];

// 1. Basic grid, first row as header, trailing newline ignored.
check('3x3 grid with trailing newline', table('Item\tQty\tPrice\nWidget\t4\t2.50\nGadget\t10\t1.25\n'), basic);
// 2. CRLF.
check('CRLF line endings', table('Item\tQty\tPrice\r\nWidget\t4\t2.50\r\nGadget\t10\t1.25\r\n'), basic);

// 3. Quoted cell with a line break, a tab and a doubled quote.
check(
	'quoted cell with newline, tab and quote',
	table('Name\tNote\nAda\t"line one\nline\ttwo ""quoted"""\nGrace\tplain\n'),
	['| Name | Note |', '| --- | --- |', '| Ada | line one<br>line\ttwo "quoted" |', '| Grace | plain |'],
);
check(
	'quoted cell in CRLF paste',
	table('Name\tNote\r\nAda\t"a\r\nb"\r\n'),
	['| Name | Note |', '| --- | --- |', '| Ada | a<br>b |'],
);

// 4. Empty cells, including an empty middle column.
check(
	'empty cells and empty middle column kept',
	table('A\t\tC\n1\t\t3\n\t\t6\n'),
	['| A | | C |', '| --- | --- | --- |', '| 1 | | 3 |', '| | | 6 |'],
);

// 5. Pipes escaped.
check('pipe in cell escaped', table('A\tB\nx|y\tz\n')?.[2], '| x\\|y | z |');

// 6. Not tab-separated rows.
check('single row', table('A\tB\tC\n'), null);
check('single column', table('A\nB\nC\n'), null);
check('ragged rows', table('A\tB\nC\n'), null);
check('tab-indented code', table('\tif (x) {\n\t\treturn 1;\n\t}\n'), null);
check('unclosed quote', table('A\tB\n"open\tC\n'), null);
check('no tabs', table('Just some text\nover two lines'), null);
check('only one non-empty row', table('A\tB\n\t\n'), null);

finish();
