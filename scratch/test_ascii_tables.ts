// Regression checks for src/ascii-tables.ts (spec/obsidian-table-paste, TASK-10 to TASK-12).
// Fixtures are synthetic tables in the layouts real tools print.
import { readFileSync } from 'node:fs';
import { check, finish } from './harness.ts';
import { htmlToMarkdown, parse } from './dom.ts';
import { convertAsciiTables, parseAsciiTable, parsePsqlTable } from '../src/ascii-tables.ts';
import { convertHtmlPaste } from '../src/html-tables.ts';
import { renderGfmTable } from '../src/table-model.ts';

const fixture = (name: string): string => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

/** Parses the lines as one table and renders it, padding collapsed; `null` if it isn't one. */
function table(text: string): string[] | null {
	const grid = parseAsciiTable(text.replace(/\n+$/, '').split('\n'));
	if (!grid) return null;
	return renderGfmTable(grid)
		.split('\n')
		.map((line, i) => (i === 1 ? line.replace(/-+/g, '---') : line).replace(/ {2,}/g, ' '));
}

const twoByTwo = ['| Name | Qty |', '| --- | --- |', '| Apple | 3 |'];

// 1. Each box-drawing style.
check('light box', table(['┌───────┬─────┐', '│ Name  │ Qty │', '├───────┼─────┤', '│ Apple │ 3   │', '└───────┴─────┘'].join('\n')), twoByTwo);
check('heavy box', table(['┏━━━━━━━┳━━━━━┓', '┃ Name  ┃ Qty ┃', '┣━━━━━━━╋━━━━━┫', '┃ Apple ┃ 3   ┃', '┗━━━━━━━┻━━━━━┛'].join('\n')), twoByTwo);
check('double box', table(['╔═══════╦═════╗', '║ Name  ║ Qty ║', '╠═══════╬═════╣', '║ Apple ║ 3   ║', '╚═══════╩═════╝'].join('\n')), twoByTwo);
check('rounded box with heavy header rule (Rich)', table(['╭───────┬─────╮', '│ Name  │ Qty │', '┡━━━━━━━╇━━━━━┩', '│ Apple │ 3   │', '╰───────┴─────╯'].join('\n')), twoByTwo);
check('mixed double header rule', table(['┌───────┬─────┐', '│ Name  │ Qty │', '╞═══════╪═════╡', '│ Apple │ 3   │', '└───────┴─────┘'].join('\n')), twoByTwo);

// 2. Claude Code style: a rule between every row; a wrapped cell becomes one row.
check('claude code table merges wrapped cell', table(fixture('claude-code-table.txt')), [
	'| Option | Description | Default |',
	'| --- | --- | --- |',
	'| --verbose | Print every step as it runs | off |',
	'| --limit | Maximum number of items | 100 |',
	'| --output | Where results go | stdout |',
]);

// spec/ascii-wrapped-cell-join: wrapped pieces join with spaces, list items with <br>.
check('cell wrapped over three lines joins with spaces', table([
	'+-----+------------------+',
	'| Key | Value            |',
	'+-----+------------------+',
	'| a   | one long cell    |',
	'|     | that wraps over  |',
	'|     | three lines      |',
	'+-----+------------------+',
	'| b   | short            |',
	'+-----+------------------+',
].join('\n'))?.[2], '| a | one long cell that wraps over three lines |');
check('list items in a cell keep line breaks', table([
	'┌──────┬─────────┐',
	'│ Step │ Notes   │',
	'├──────┼─────────┤',
	'│ 1    │ - one   │',
	'│      │ - two   │',
	'├──────┼─────────┤',
	'│ 2    │ 1. one  │',
	'│      │ 2. two  │',
	'└──────┴─────────┘',
].join('\n'))?.slice(2), ['| 1 | - one<br>- two |', '| 2 | 1. one<br>2. two |']);
check('wrapped header cell joins with a space', table([
	'┌──────────┬─────┐',
	'│ Long     │ Qty │',
	'│ heading  │     │',
	'├──────────┼─────┤',
	'│ x        │ 1   │',
	'└──────────┴─────┘',
].join('\n'))?.[0], '| Long heading | Qty |');

// 3 and 5. MySQL grid; a | inside a cell doesn't split it.
check('mysql grid with pipe in cell', table(fixture('mysql-table.txt')), [
	'| id | name | score |',
	'| --- | --- | --- |',
	'| 1 | Ada | 91 |',
	'| 2 | Grace | 88 |',
	'| 3 | Linus\\|Tor | 75 |',
]);

// tabulate "grid": = under the header, a rule after every row.
check('tabulate grid', table(['+--------+-------+', '| item   |   qty |', '+========+=======+', '| spam   |    42 |', '+--------+-------+', '| eggs   |   451 |', '+--------+-------+'].join('\n')), [
	'| item | qty |',
	'| --- | --- |',
	'| spam | 42 |',
	'| eggs | 451 |',
]);

// Wide characters: terminals pad by display width, so columns are found by it.
check('CJK content keeps columns', table(['┌──────┬──────┐', '│ 都市 │ 人口 │', '├──────┼──────┤', '│ 東京 │ 14m  │', '└──────┴──────┘'].join('\n')), [
	'| 都市 | 人口 |',
	'| --- | --- |',
	'| 東京 | 14m |',
]);

// Indented and with trailing spaces, as terminal copies often are.
check('indent and trailing spaces tolerated', table(['    +------+-----+   ', '    | Name | Qty |', '    +------+-----+', '    | Apple | 3 |  ', '    +------+-----+'].join('\n')), [
	'| Name | Qty |',
	'| --- | --- |',
	'| Apple | 3 |',
]);

// No header rule: the first line is promoted.
check('no header rule promotes first line', table(['+---+---+', '| a | b |', '| c | d |', '+---+---+'].join('\n')), ['| a | b |', '| --- | --- |', '| c | d |']);

// 8 (parser part). Things that aren't tables to convert.
check('markdown table left alone', table(['| a | b |', '|---|---|', '| 1 | 2 |'].join('\n')), null);
check('single-column box left alone', table(['┌──────────┐', '│ Warning! │', '└──────────┘'].join('\n')), null);
check('prose is not a table', table('Just a sentence | with a pipe |'), null);
check('bare pipe lines without borders are not a table', table(['| a | b |', '| c | d |'].join('\n')), null);
check('ragged rows are not a table', table(['+---+---+', '| a | b |', '| c |', '+---+---+'].join('\n')), null);

// 4. psql (TASK-11): borderless, `---+---` underline, footer dropped.
/** Like table(), but through the psql parser. */
function psql(text: string): string[] | null {
	const grid = parsePsqlTable(text.split('\n'));
	if (!grid) return null;
	return renderGfmTable(grid)
		.split('\n')
		.map((line, i) => (i === 1 ? line.replace(/-+/g, '---') : line).replace(/ {2,}/g, ' '));
}
check('psql table with footer', psql(fixture('psql-table.txt')), [
	'| id | name | joined |',
	'| --- | --- | --- |',
	'| 1 | Ada | 2024-01-05 |',
	'| 2 | Grace Hopper | |',
]);
check('psql single row footer', psql([' n ', '---', ' 1 ', '(1 row)'].join('\n')), null);
check('psql without rule is not psql', psql([' a | b', ' 1 | 2'].join('\n')), null);

// --- convertAsciiTables (TASK-12) ---

const box = ['┌───────┬─────┐', '│ Name  │ Qty │', '├───────┼─────┤', '│ Apple │ 3   │', '└───────┴─────┘'];
const boxMd = ['| Name  | Qty |', '| ----- | --- |', '| Apple | 3   |'];

// 6. Surrounding text is unchanged, and blank lines separate the table.
check(
	'surrounding text kept, blank lines added',
	convertAsciiTables(['Here are the results:', ...box, 'Done.  ', '  indented tail'].join('\n')),
	['Here are the results:', '', ...boxMd, '', 'Done.  ', '  indented tail'].join('\n'),
);
check('existing blank lines not doubled', convertAsciiTables(['Intro', '', ...box, '', 'Outro'].join('\n')), ['Intro', '', ...boxMd, '', 'Outro'].join('\n'));
check('CRLF paste keeps CRLF', convertAsciiTables(['Intro', ...box].join('\r\n')), ['Intro', '', ...boxMd].join('\r\n'));

// 7. Two tables in one paste.
check(
	'two tables both convert',
	convertAsciiTables([...box, 'and', ...fixture('mysql-table.txt').trimEnd().split('\n')].join('\n'))?.split('\n').filter((l) => l.startsWith('| ---') || l.startsWith('| -')).length,
	2,
);

// psql output inside surrounding shell text.
check(
	'psql in a transcript',
	convertAsciiTables(['db=> select id, name from users;', ...fixture('psql-table.txt').trimEnd().split('\n'), 'db=> '].join('\n'))?.split('\n'),
	['db=> select id, name from users;', '', '| id  | name         | joined     |', '| --- | ------------ | ---------- |', '| 1   | Ada          | 2024-01-05 |', '| 2   | Grace Hopper |            |', '', 'db=> '],
);

// 8. Nothing to convert.
check('whitespace-aligned columns left alone', convertAsciiTables(['NAME      STATUS   AGE', 'web-1     Running  3d', 'web-2     Pending  1m'].join('\n')), null);
check('markdown table left alone', convertAsciiTables(['| a | b |', '|---|---|', '| 1 | 2 |'].join('\n')), null);
check('drawn box left alone', convertAsciiTables(['┌──────────┐', '│ Warning! │', '└──────────┘'].join('\n')), null);
check('prose left alone', convertAsciiTables('Plain prose.\nWith a second line, and a | pipe.'), null);

// 9. A <pre> holding a box-drawing table, inside pasted HTML.
check(
	'pre with box table converts in HTML paste',
	convertHtmlPaste(`<p>Output:</p><pre><code>${box.join('\n')}\n</code></pre><p>After</p>`, { parse, htmlToMarkdown }),
	['Output:', '', ...boxMd, '', 'After'].join('\n'),
);
check('pre with ordinary code left alone', convertHtmlPaste('<pre><code>const a = 1;</code></pre>', { parse, htmlToMarkdown }), null);

finish();
