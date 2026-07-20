import { Queryable } from 'zapatos/db';
import { ProgressLogger } from 'ropegeo-common/helpers';
import getContributors from '../http/getContributors';
import updateRopewikiPageAuthors from '../database/updateRopewikiPageAuthors';
import updateRopewikiImageAuthors from '../database/updateRopewikiImageAuthors';
import { RopewikiImage } from '../types/image';
import {
    fileTitleFromLinkUrl,
    isKmlFileTitle,
    lookupContributors,
    wikiTitleFromPageUrl,
} from '../util/wikiTitles';

/**
 * Fetches MediaWiki contributors for a page and its non-KML images, then writes authors.
 * Non-fatal: on failure, logs and sets authors to null.
 */
export async function processPageAndImageAuthors(
    client: Queryable,
    page: { id: string; url: string; externalPageId: string; name: string },
    upsertedImages: RopewikiImage[],
    logger: ProgressLogger,
): Promise<void> {
    const imagesWithIds = upsertedImages.filter((img) => img.id != null && img.id !== '');

    try {
        const pageTitle = wikiTitleFromPageUrl(page.url);
        const fileTitles = imagesWithIds
            .map((img) => fileTitleFromLinkUrl(img.linkUrl))
            .filter((t): t is string => t != null && !isKmlFileTitle(t));
        const byTitle = await getContributors([pageTitle, ...fileTitles]);

        await updateRopewikiPageAuthors(
            client,
            page.id,
            lookupContributors(byTitle, pageTitle) ?? null,
        );

        await updateRopewikiImageAuthors(
            client,
            imagesWithIds.map((img) => {
                const fileTitle = fileTitleFromLinkUrl(img.linkUrl);
                const authors =
                    fileTitle == null || isKmlFileTitle(fileTitle)
                        ? null
                        : lookupContributors(byTitle, fileTitle) ?? null;
                return { id: img.id!, authors };
            }),
        );
    } catch (attributionError) {
        const msg =
            attributionError instanceof Error
                ? attributionError.message
                : String(attributionError);
        logger.logError(
            `Attribution fetch failed for page ${page.externalPageId} ${page.name}: ${msg}`,
        );
        await updateRopewikiPageAuthors(client, page.id, null);
        await updateRopewikiImageAuthors(
            client,
            imagesWithIds.map((img) => ({ id: img.id!, authors: null })),
        );
    }
}

export default processPageAndImageAuthors;
