import * as fs from 'fs';
import * as path from 'path';
import { PageDataSource } from '../src/types/pageRoute';
import httpRequest from '../src/helpers/httpRequest';
import parseRopewikiPage from '../src/ropewiki/parsers/parseRopewikiPage';

/**
 * Get the Ropewiki page title from a page URL.
 * E.g. https://ropewiki.com/Bear_Creek_Canyon -> Bear_Creek_Canyon
 */
function getRopewikiTitleFromUrl(url: string): string {
    const pathname = new URL(url).pathname;
    return pathname.replace(/^\/|\/$/g, '') || pathname.slice(1);
}

/**
 * Fetch Ropewiki page HTML (parsed content) via the MediaWiki API using the page title.
 */
async function getRopewikiPageHtmlByTitle(title: string): Promise<string> {
    const apiUrl = `https://ropewiki.com/api.php?action=parse&page=${encodeURIComponent(title)}&format=json`;
    const response = await httpRequest(apiUrl);
    const body = (await response.json()) as { parse?: { text?: { '*': string } } };
    const html = body.parse?.text?.['*'];
    if (typeof html !== 'string') {
        throw new Error(`Unexpected API response: missing parse.text['*']`);
    }
    return html;
}

/**
 * Script to fetch a page by URL, parse it, and write beta/images to examples/<title>/.
 * Usage: ts-node scripts/testPageParse.ts <pageType> <url>
 * Example: ts-node scripts/testPageParse.ts ropewiki https://ropewiki.com/Bear_Creek_Canyon
 */
async function main() {
    const pageTypeArg = process.argv[2];
    const urlArg = process.argv[3];

    if (!pageTypeArg || !urlArg) {
        console.error('Usage: ts-node scripts/testPageParse.ts <pageType> <url>');
        console.error('Example: ts-node scripts/testPageParse.ts ropewiki https://ropewiki.com/Bear_Creek_Canyon');
        process.exit(1);
    }

    if (!Object.values(PageDataSource).includes(pageTypeArg as PageDataSource)) {
        console.error(
            `Invalid pageType: ${pageTypeArg}. pageType must be one of ${Object.values(PageDataSource).join(', ')}`,
        );
        process.exit(1);
    }

    const pageType = pageTypeArg as PageDataSource;
    const url = urlArg;

    if (pageType === PageDataSource.Ropewiki) {
        const title = getRopewikiTitleFromUrl(url);
        console.log(`Fetching Ropewiki page: ${title}`);

        const pageHtml = await getRopewikiPageHtmlByTitle(title);
        const { beta, images } = await parseRopewikiPage(pageHtml);

        const examplesDir = path.join(process.cwd(), 'examples', title);
        fs.mkdirSync(examplesDir, { recursive: true });

        const betaPath = path.join(examplesDir, 'beta.json');
        const imagesPath = path.join(examplesDir, 'images.json');

        fs.writeFileSync(betaPath, JSON.stringify(beta, null, 2), 'utf-8');
        fs.writeFileSync(imagesPath, JSON.stringify(images, null, 2), 'utf-8');

        console.log(`Wrote ${betaPath}`);
        console.log(`Wrote ${imagesPath}`);
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Error:', error);
        process.exit(1);
    });
}
