import { getContributors } from '../../ropewiki/http/getContributors';
import { lookupContributors } from '../../ropewiki/util/wikiTitles';

const ROPEWIKI_IMAGES_KML_PATH =
    /^https?:\/\/ropewiki\.com\/images\/[^/]+\/[^/]+\/([^/?#]+\.kml)$/i;

/**
 * Resolve map-file authors for a Ropewiki MapData sourceFileUrl.
 * Only `/images/{a}/{b}/{file}.kml` URLs are supported; proxy/Luca URLs return null.
 */
export async function getRopewikiMapDataAuthors(
    sourceFileUrl: string,
): Promise<string[] | null> {
    const match = ROPEWIKI_IMAGES_KML_PATH.exec(sourceFileUrl.trim());
    if (match == null) {
        return null;
    }
    const filename = decodeURIComponent(match[1]!);
    const fileTitle = filename.startsWith('File:') ? filename : `File:${filename}`;

    try {
        const byTitle = await getContributors([fileTitle]);
        return lookupContributors(byTitle, fileTitle) ?? null;
    } catch (error) {
        console.error(
            `getRopewikiMapDataAuthors failed for ${sourceFileUrl}: ${
                error instanceof Error ? error.message : String(error)
            }`,
        );
        return null;
    }
}

export default getRopewikiMapDataAuthors;
