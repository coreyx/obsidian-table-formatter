// Regression checks for the paste handler in src/main.ts (spec/obsidian-table-paste, TASK-7 onward).
// Loads the built main.js (run `npm run build` first) with a fake `obsidian` module and drives
// simulated paste events through it.
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { check, finish } from './harness.ts';
import { htmlToMarkdown, parse } from './dom.ts';

type Handler = (evt: unknown, editor: unknown) => void;
const handlers: Record<string, Handler> = {};
const vaultConfig: Record<string, unknown> = {};

class FakePlugin {
	app = {
		workspace: { on: (name: string, cb: Handler) => ((handlers[name] = cb), { name }) },
		vault: { getConfig: (key: string) => vaultConfig[key] },
	};
	registerEvent(): void {}
	registerDomEvent(target: { addEventListener: (type: string, cb: (e: unknown) => void, opts?: unknown) => void }, type: string, cb: (e: unknown) => void, opts?: unknown): void {
		target.addEventListener(type, cb, opts);
	}
	addSettingTab(): void {}
	async loadData(): Promise<unknown> {
		return null;
	}
	async saveData(): Promise<void> {}
}

const fakeObsidian = {
	Plugin: FakePlugin,
	PluginSettingTab: class {},
	Setting: class {},
	htmlToMarkdown,
};

// Browser globals main.js uses at runtime.
const g = globalThis as Record<string, unknown>;
g.DOMParser = class {
	parseFromString(source: string): Document {
		return parse(source);
	}
};
const listeners: Record<string, ((e: unknown) => void)[]> = {};
g.document = {
	addEventListener: (type: string, cb: (e: unknown) => void) => (listeners[type] ??= []).push(cb),
};

// main.js is a CommonJS bundle, but package.json says "type": "module", so
// evaluate it directly with a require that hands it the fake `obsidian`.
const nodeRequire = createRequire(import.meta.url);
const bundle = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const mod: { exports: Record<string, unknown> } = { exports: {} };
new Function('module', 'exports', 'require', bundle)(mod, mod.exports, (request: string) =>
	request === 'obsidian' ? fakeObsidian : nodeRequire(request),
);
const PluginClass = (mod.exports as { default: new () => FakePlugin & { onload(): Promise<void> } }).default;
const plugin = new PluginClass();
await plugin.onload();

/** Simulates one paste and reports what happened to it. */
function paste(data: Record<string, string>): { prevented: boolean; inserted: string | null } {
	let prevented = false;
	let inserted: string | null = null;
	const evt = {
		defaultPrevented: false,
		clipboardData: { getData: (type: string) => data[type] ?? '' },
		preventDefault() {
			prevented = true;
			this.defaultPrevented = true;
		},
	};
	const editor = { replaceSelection: (text: string) => (inserted = text) };
	handlers['editor-paste']?.(evt, editor);
	return { prevented, inserted };
}

const table = '<table><tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr></table>';
const tableMd = '| A   | B   |\n| --- | --- |\n| 1   | 2   |';

check('registers an editor-paste handler', typeof handlers['editor-paste'], 'function');
check('HTML table paste is converted', paste({ 'text/html': table, 'text/plain': 'A\tB\n1\t2' }), { prevented: true, inserted: tableMd });
check('HTML without a table falls through', paste({ 'text/html': '<p>hi</p>', 'text/plain': 'hi' }), { prevented: false, inserted: null });
check('plain text without a table falls through', paste({ 'text/plain': 'just text' }), { prevented: false, inserted: null });

const already = { defaultPrevented: true, clipboardData: { getData: () => table }, preventDefault() {} };
let touched = false;
handlers['editor-paste']?.(already, { replaceSelection: () => (touched = true) });
check('paste already handled by another plugin is ignored', touched, false);

(plugin as unknown as { settings: { convertHtmlTables: boolean } }).settings.convertHtmlTables = false;
check('HTML setting off falls through', paste({ 'text/html': table }), { prevented: false, inserted: null });
(plugin as unknown as { settings: { convertHtmlTables: boolean } }).settings.convertHtmlTables = true;

// TASK-8: Ctrl/Cmd+Shift+V skips conversion for the paste that follows, and only that one.
const keydown = (init: Record<string, unknown>): void => listeners.keydown?.forEach((cb) => cb({ key: 'V', ctrlKey: false, metaKey: false, shiftKey: false, ...init }));
check('keydown listener registered on document', (listeners.keydown ?? []).length, 1);
keydown({ ctrlKey: true, shiftKey: true });
check('Ctrl+Shift+V paste is left alone', paste({ 'text/html': table }), { prevented: false, inserted: null });
check('the next ordinary paste converts again', paste({ 'text/html': table }).prevented, true);
keydown({ metaKey: true, shiftKey: true, key: 'v' });
check('Cmd+Shift+V paste is left alone', paste({ 'text/html': table }).prevented, false);
keydown({ ctrlKey: true, key: 'v' });
check('plain Ctrl+V still converts', paste({ 'text/html': table }).prevented, true);

// TASK-9: Obsidian's "Convert pasted HTML to Markdown" setting is honored.
vaultConfig.autoConvertHtml = false;
check('HTML conversion off in Obsidian: falls through', paste({ 'text/html': table }), { prevented: false, inserted: null });
vaultConfig.autoConvertHtml = true;
check('HTML conversion on in Obsidian: converts', paste({ 'text/html': table }).prevented, true);
delete vaultConfig.autoConvertHtml;
check('setting missing: treated as on', paste({ 'text/html': table }).prevented, true);

// TASK-13: plain-text ASCII tables.
const box = ['┌───┬───┐', '│ A │ B │', '├───┼───┤', '│ 1 │ 2 │', '└───┴───┘'].join('\n');
const settings = (plugin as unknown as { settings: { convertHtmlTables: boolean; convertAsciiTables: boolean } }).settings;
check('terminal ASCII table converts', paste({ 'text/plain': box }), { prevented: true, inserted: tableMd });
check('ASCII table with non-table HTML converts from plain text', paste({ 'text/html': '<div><span>┌───┬───┐</span></div>', 'text/plain': box }).inserted, tableMd);
vaultConfig.autoConvertHtml = false;
check('ASCII still converts when Obsidian HTML conversion is off', paste({ 'text/html': table, 'text/plain': box }).inserted, tableMd);
delete vaultConfig.autoConvertHtml;
settings.convertAsciiTables = false;
check('ASCII setting off falls through', paste({ 'text/plain': box }), { prevented: false, inserted: null });
check('ASCII setting off leaves <pre> tables alone', paste({ 'text/html': `<pre>${box}</pre>`, 'text/plain': box }), { prevented: false, inserted: null });
settings.convertAsciiTables = true;
keydown({ ctrlKey: true, shiftKey: true });
check('Ctrl+Shift+V leaves an ASCII table alone', paste({ 'text/plain': box }), { prevented: false, inserted: null });

// spec/spreadsheet-tsv-paste TASK-3: tab-separated rows.
const tsv = 'A\tB\n1\t2\n';
const tsvSettings = settings as typeof settings & { convertTsvTables: boolean };
check('tab-separated plain text converts', paste({ 'text/plain': tsv }), { prevented: true, inserted: tableMd });
check('tab-separated text with non-table HTML is left alone', paste({ 'text/html': '<pre>A\tB</pre>', 'text/plain': tsv }), { prevented: false, inserted: null });
tsvSettings.convertTsvTables = false;
check('TSV setting off falls through', paste({ 'text/plain': tsv }), { prevented: false, inserted: null });
tsvSettings.convertTsvTables = true;
keydown({ ctrlKey: true, shiftKey: true });
check('Ctrl+Shift+V leaves tab-separated text alone', paste({ 'text/plain': tsv }), { prevented: false, inserted: null });
check('ASCII box table still converts with TSV on', paste({ 'text/plain': box }).inserted, tableMd);

finish();
