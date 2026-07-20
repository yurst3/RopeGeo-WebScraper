import type { ImageNeedingAuthors } from '../database/getImagesNeedingAuthors';
import type { PageNeedingAuthors } from '../database/getPagesNeedingAuthors';

export type PageAuthorWorkItem = {
    page: PageNeedingAuthors;
    pageNeedsAuthors: boolean;
    pageImages: ImageNeedingAuthors[];
};

/**
 * Builds per-page work items from pages needing authors and images needing authors.
 * `pageById` must include urls for any page that only has image backfill work.
 */
export function buildPageAuthorWorkItems(
    pagesNeedingAuthors: PageNeedingAuthors[],
    imagesNeedingAuthors: ImageNeedingAuthors[],
    pageById: Map<string, PageNeedingAuthors>,
): PageAuthorWorkItem[] {
    const imagesByPage = new Map<string, ImageNeedingAuthors[]>();
    imagesNeedingAuthors.forEach((img) => {
        const list = imagesByPage.get(img.ropewikiPage) ?? [];
        list.push(img);
        imagesByPage.set(img.ropewikiPage, list);
    });

    const pagesNeedingAuthorsIds = new Set(pagesNeedingAuthors.map((p) => p.id));
    const pageIdsNeedingWork = [
        ...new Set([
            ...pagesNeedingAuthors.map((p) => p.id),
            ...imagesNeedingAuthors.map((i) => i.ropewikiPage),
        ]),
    ];

    return pageIdsNeedingWork
        .map((pageId) => {
            const page = pageById.get(pageId);
            if (page == null) return null;
            const pageNeedsAuthors = pagesNeedingAuthorsIds.has(pageId);
            const pageImages = imagesByPage.get(pageId) ?? [];
            if (!pageNeedsAuthors && pageImages.length === 0) return null;
            return { page, pageNeedsAuthors, pageImages };
        })
        .filter((item): item is PageAuthorWorkItem => item != null);
}

export default buildPageAuthorWorkItems;
