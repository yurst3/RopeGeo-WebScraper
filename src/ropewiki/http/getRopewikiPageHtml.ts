import { httpRequest } from 'ropegeo-common/helpers';

/**
 * Fetches parsed HTML for a Ropewiki page by external page id.
 */
export async function getRopewikiPageHtml(pageId: string): Promise<string> {
    const url = `https://ropewiki.com/api.php?action=parse&pageid=${encodeURIComponent(pageId)}&format=json`;

    try {
        const response = await httpRequest(url);
        const body = (await response.json()) as { parse?: { text?: { '*': string } } };
        const html = body.parse?.text?.['*'];
        if (typeof html !== 'string') {
            throw new Error('parse.text.* missing from MediaWiki parse response');
        }
        return html;
    } catch (error) {
        throw new Error(`Error getting ropewiki page html: ${error}`);
    }
}

export default getRopewikiPageHtml;
