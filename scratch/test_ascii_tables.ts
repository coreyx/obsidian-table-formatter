// Regression checks for src/ascii-tables.ts (spec/obsidian-table-paste, TASK-10 to TASK-12).
// Fixtures are synthetic tables in the layouts real tools print.
import { readFileSync } from 'node:fs';
import { check, finish } from './harness.ts';
import { parseAsciiTable } from '../src/ascii-tables.ts';
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
	'| --verbose | Print every step as it<br>runs | off |',
	'| --limit | Maximum number of items | 100 |',
	'| --output | Where results go | stdout |',
]);

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

finish();
