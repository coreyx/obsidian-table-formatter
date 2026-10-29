/**
 * Test-only stand-ins for the browser and Obsidian pieces the converters
 * receive as dependencies: linkedom for `DOMParser`, and turndown (which
 * Obsidian's own `htmlToMarkdown()` is built on) for the Markdown converter.
 */
import { parseHTML } from 'linkedom';
import TurndownService from 'turndown';

const turndown = new TurndownService({
	headingStyle: 'atx',
	codeBlockStyle: 'fenced',
	bulletListMarker: '-',
	emDelimiter: '*',
});

/**
 * Parses an HTML string (a full clipboard document or a fragment) into a
 * Document, the way `DOMParser.parseFromString(html, 'text/html')` would.
 */
export function parse(html: string): Document {
	const wrapped = /<html[\s>]/i.test(html) ? html : `<!doctype html><html><head></head><body>${html}</body></html>`;
	return parseHTML(wrapped).document as unknown as Document;
}

/**
 * Converts an element, fragment or string to Markdown with turndown.
 */
export function htmlToMarkdown(input: HTMLElement | DocumentFragment | string): string {
	if (typeof input === 'string') return turndown.turndown(input);
	if ('outerHTML' in input) return turndown.turndown(input.outerHTML);
	const holder = parse('').createElement('div');
	holder.appendChild(input.cloneNode(true));
	return turndown.turndown(holder.innerHTML);
}
