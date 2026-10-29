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
	 * Loads settings, adds the settings tab and starts listening for pastes.
	 */
	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new TableFormatterSettingTab(this.app, this));
		this.registerEvent(this.app.workspace.on('editor-paste', this.handlePaste));
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

		const markdown = this.convertClipboard(evt.clipboardData);
		if (markdown === null) return;

		evt.preventDefault();
		editor.replaceSelection(markdown);
	};

	/**
	 * Works out what to paste for the given clipboard contents.
	 *
	 * @returns The Markdown to insert, or `null` to let Obsidian paste natively.
	 */
	private convertClipboard(data: DataTransfer): string | null {
		const html = data.getData('text/html');
		if (html && this.settings.convertHtmlTables) {
			const converted = convertHtmlPaste(html, {
				parse: (source) => new DOMParser().parseFromString(source, 'text/html'),
				htmlToMarkdown,
			});
			if (converted !== null) return converted;
		}
		return null;
	}
}
