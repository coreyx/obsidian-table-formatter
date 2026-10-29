// Regression checks for src/table-model.ts (spec/obsidian-table-paste, TASK-3).
import { check, finish } from './harness.ts';
import { escapePipes, formatCell, renderGfmTable } from '../src/table-model.ts';

check('escapes bare pipe', escapePipes('a|b'), 'a\\|b');
check('leaves escaped pipe', escapePipes('a\\|b'), 'a\\|b');
check('escapes pipe after escaped backslash', escapePipes('a\\\\|b'), 'a\\\\\\|b');
check('escapes adjacent pipes', escapePipes('||'), '\\|\\|');

check('newline becomes <br>', formatCell('line one\nline two'), 'line one<br>line two');
check('blank lines fold to one <br>', formatCell('  a \n\n  b  '), 'a<br>b');
check('nbsp becomes space and trims', formatCell(' x '), 'x');

check(
	'ragged rows padded',
	renderGfmTable({ header: ['A', 'B', 'C'], rows: [['1'], ['1', '2', '3']], align: [] }),
	['| A   | B   | C   |', '| --- | --- | --- |', '| 1   |     |     |', '| 1   | 2   | 3   |'].join('\n'),
);

check(
	'row longer than header widens table',
	renderGfmTable({ header: ['A'], rows: [['1', '2']], align: [] }),
	['| A   |     |', '| --- | --- |', '| 1   | 2   |'].join('\n'),
);

check(
	'alignment row',
	renderGfmTable({ header: ['Left', 'Center', 'Right', 'None'], rows: [], align: ['left', 'center', 'right', null] }),
	['| Left | Center | Right | None |', '| :--- | :----: | ----: | ---- |'].join('\n'),
);

const wide = renderGfmTable({ header: ['名前', 'Emoji'], rows: [['東京', '🎉🎉'], ['x', 'y']], align: [] });
const wideLines = wide.split('\n');
check('wide characters: every line has 3 unescaped pipes', wideLines.map((l) => l.split('|').length - 1), [3, 3, 3, 3]);
check('wide characters: emoji column padded by code points', wideLines[2], '| 東京  | 🎉🎉    |');

check('pipe and newline in cell', renderGfmTable({ header: ['h'], rows: [['a|b\nc']], align: [] }).split('\n')[2], '| a\\|b<br>c |');
check('empty grid renders nothing', renderGfmTable({ header: [], rows: [], align: [] }), '');

finish();
