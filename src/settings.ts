import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';

/**
 * User-facing switches, one per kind of table, so any conversion can be
 * turned off without disabling the plugin.
 */
export interface TableFormatterSettings {
	/** Convert tables in pasted HTML (browsers, spreadsheets, documents). */
	convertHtmlTables: boolean;
	/** Convert ASCII and box-drawing tables in pasted plain text. */
	convertAsciiTables: boolean;
	/** Convert pastes that are only tab-separated rows (some spreadsheet apps). */
	convertTsvTables: boolean;
}

/** Settings for a fresh install: every conversion on. */
export const DEFAULT_SETTINGS: TableFormatterSettings = {
	convertHtmlTables: true,
	convertAsciiTables: true,
	convertTsvTables: true,
};

/**
 * What the settings tab needs from the plugin. Kept as an interface so this
 * file doesn't import the plugin class and create an import cycle.
 */
export interface SettingsHost extends Plugin {
	settings: TableFormatterSettings;
	saveSettings(): Promise<void>;
}

/**
 * The plugin's page under Settings → Community plugins.
 */
export class TableFormatterSettingTab extends PluginSettingTab {
	private readonly host: SettingsHost;

	/**
	 * @param app - The Obsidian app instance.
	 * @param host - The plugin whose settings this tab edits.
	 */
	constructor(app: App, host: SettingsHost) {
		super(app, host);
		this.host = host;
	}

	/**
	 * Draws one toggle per setting; each change is saved immediately.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Convert HTML tables')
			.setDesc(
				'Paste tables copied from web pages, spreadsheets and documents as Markdown tables. ' +
					'Follows Obsidian\'s "Convert pasted HTML to Markdown" editor setting.',
			)
			.addToggle((toggle) =>
				toggle.setValue(this.host.settings.convertHtmlTables).onChange(async (value) => {
					this.host.settings.convertHtmlTables = value;
					await this.host.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Convert ASCII tables')
			.setDesc('Paste box-drawing, +---+ grid and psql-style tables from terminals and CLI tools as Markdown tables.')
			.addToggle((toggle) =>
				toggle.setValue(this.host.settings.convertAsciiTables).onChange(async (value) => {
					this.host.settings.convertAsciiTables = value;
					await this.host.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName('Convert tab-separated data')
			.setDesc('Paste rows copied as tab-separated text, as some spreadsheet apps do, as Markdown tables.')
			.addToggle((toggle) =>
				toggle.setValue(this.host.settings.convertTsvTables).onChange(async (value) => {
					this.host.settings.convertTsvTables = value;
					await this.host.saveSettings();
				}),
			);
	}
}
