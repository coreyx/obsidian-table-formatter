import { Editor, Plugin, htmlToMarkdown } from 'obsidian';
import { convertHtmlPaste } from './html-tables.ts';
import { DEFAULT_SETTINGS, TableFormatterSettingTab } from './settings.ts';
import type { SettingsHost, TableFormatterSettings } from './settings.ts';

/**
 * Pastes tables as GFM Markdown tables. It only reads the clipboard during a
 * paste and never writes to it, so copying keeps working normally everywhere
 * else; pastes it has nothing to add to fall through to Obsidian untouched.
 */
export default class TableFormatterPlugin extends Plugin implements SettingsHost {
	settings: TableFormatterSettings = { ...DEFAULT_SETTINGS };

	/**
	 * Time (ms since epoch) until which a paste counts as paste-as-plain-text,
	 * set by the Ctrl/Cmd+Shift+V keydown that precedes it.
	 */
	private plainPasteUntil = 0;

	/**
	 * Loads settings, adds the settings tab and starts listening for pastes.
	 */
	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new TableFormatterSettingTab(this.app, this));
		this.registerEvent(this.app.workspace.on('editor-paste', this.handlePaste));

		// Pop-out windows have their own document, so watch each one's keys too.
		this.watchPlainPasteShortcut(document);
		this.registerEvent(this.app.workspace.on('window-open', (_win, popout) => this.watchPlainPasteShortcut(popout.document)));
	}

	/**
	 * Remembers when Ctrl/Cmd+Shift+V is pressed. Chromium delivers that
	 * shortcut as an ordinary paste event carrying only plain text, so the key
	 * press is the only way to tell that the user asked for the raw text.
	 * Listening in the capture phase sees the key before the editor acts on it.
	 */
	private watchPlainPasteShortcut(doc: Document): void {
		this.registerDomEvent(
			doc,
			'keydown',
			(evt: KeyboardEvent) => {
				if ((evt.ctrlKey || evt.metaKey) && evt.shiftKey && evt.key.toLowerCase() === 'v') {
					// The paste event follows the keydown immediately; the window
					// only needs to cover that gap without catching a later paste.
					this.plainPasteUntil = Date.now() + 1000;
				}
			},
			{ capture: true },
		);
	}

	/**
	 * Reads saved settings over the defaults, so settings added in a later
	 * version start at their default.
	 */
	async loadSettings(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<TableFormatterSettings> | null) };
	}

	/**
	 * Persists the current settings to the plugin's `data.json`.
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Handles an editor paste: when the clipboard holds something this plugin
	 * converts, inserts the converted Markdown and cancels the native paste.
	 * `replaceSelection` is a single editor transaction, so one undo reverts it.
	 */
	private readonly handlePaste = (evt: ClipboardEvent, editor: Editor): void => {
		// Another plugin already took this paste.
		if (evt.defaultPrevented || !evt.clipboardData) return;

		// Paste-as-plain-text is the user's way to skip conversion.
		const plainPaste = Date.now() < this.plainPasteUntil;
		this.plainPasteUntil = 0;
		if (plainPaste) return;

		const markdown = this.convertClipboard(evt.clipboardData);
		if (markdown === null) return;

		evt.preventDefault();
		editor.replaceSelection(markdown);
	};

	/**
	 * Whether Obsidian's own Settings → Editor → "Convert pasted HTML to
	 * Markdown" is on. When it's off, Obsidian pastes plain text, and HTML
	 * tables are left alone to match.
	 *
	 * `getConfig` and the `autoConvertHtml` key aren't in the public API
	 * (the key was confirmed in Obsidian 1.14.5's own paste handler), so
	 * anything unexpected is treated as the default: on.
	 */
	private isHtmlConversionEnabled(): boolean {
		const vault = this.app.vault as unknown as { getConfig?: (key: string) => unknown };
		try {
			return vault.getConfig?.('autoConvertHtml') !== false;
		} catch {
			return true;
		}
	}

	/**
	 * Works out what to paste for the given clipboard contents.
	 *
	 * @returns The Markdown to insert, or `null` to let Obsidian paste natively.
	 */
	private convertClipboard(data: DataTransfer): string | null {
		const html = data.getData('text/html');
		if (html && this.settings.convertHtmlTables && this.isHtmlConversionEnabled()) {
			const converted = convertHtmlPaste(html, {
				parse: (source) => new DOMParser().parseFromString(source, 'text/html'),
				htmlToMarkdown,
			});
			if (converted !== null) return converted;
		}
		return null;
	}
}
