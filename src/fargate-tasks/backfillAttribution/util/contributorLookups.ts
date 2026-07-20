import {
    fileTitleFromLinkUrl,
    isKmlFileTitle,
    lookupContributors,
    wikiTitleFromPageUrl,
} from '../../../ropewiki/util/wikiTitles';
import type { ImageAuthorsUpdate } from '../../../ropewiki/database/updateRopewikiImageAuthors';
import type { PageAuthorWorkItem } from './buildPageAuthorWorkItems';

/** MediaWiki titles to request for one page work item. */
export function contributorTitlesForWorkItem(item: PageAuthorWorkItem): string[] {
    const pageTitle = wikiTitleFromPageUrl(item.page.url);
    const fileTitles = item.pageImages
        .map((img) => fileTitleFromLinkUrl(img.linkUrl))
        .filter((t): t is string => t != null && !isKmlFileTitle(t));
    return item.pageNeedsAuthors ? [pageTitle, ...fileTitles] : fileTitles;
}

/** Resolve page authors from a contributors map; null when not found. */
export function pageAuthorsFromContributors(
    byTitle: Record<string, string[]>,
    pageUrl: string,
): string[] | null {
    return lookupContributors(byTitle, wikiTitleFromPageUrl(pageUrl)) ?? null;
}

/** Map images to author updates via linkUrl → File: title lookup. */
export function imageAuthorUpdatesFromContributors(
    images: Array<{ id: string; linkUrl: string }>,
    byTitle: Record<string, string[]>,
): ImageAuthorsUpdate[] {
    return images.map((img) => {
        const fileTitle = fileTitleFromLinkUrl(img.linkUrl);
        const authors =
            fileTitle == null || isKmlFileTitle(fileTitle)
                ? null
                : lookupContributors(byTitle, fileTitle) ?? null;
        return { id: img.id, authors };
    });
}
