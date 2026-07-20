import { describe, it, expect } from '@jest/globals';
import { buildPageAuthorWorkItems } from '../../../../src/fargate-tasks/backfillAttribution/util/buildPageAuthorWorkItems';

describe('buildPageAuthorWorkItems', () => {
    const pageA = { id: 'page-a', url: 'https://ropewiki.com/A' };
    const pageB = { id: 'page-b', url: 'https://ropewiki.com/B' };
    const imgA1 = {
        id: 'img-a1',
        ropewikiPage: 'page-a',
        linkUrl: 'https://ropewiki.com/File:a1.jpg',
    };
    const imgB1 = {
        id: 'img-b1',
        ropewikiPage: 'page-b',
        linkUrl: 'https://ropewiki.com/File:b1.jpg',
    };

    it('includes pages that need authors even without images', () => {
        const pageById = new Map([[pageA.id, pageA]]);
        const items = buildPageAuthorWorkItems([pageA], [], pageById);
        expect(items).toEqual([
            { page: pageA, pageNeedsAuthors: true, pageImages: [] },
        ]);
    });

    it('includes pages that only need image authors', () => {
        const pageById = new Map([[pageB.id, pageB]]);
        const items = buildPageAuthorWorkItems([], [imgB1], pageById);
        expect(items).toEqual([
            { page: pageB, pageNeedsAuthors: false, pageImages: [imgB1] },
        ]);
    });

    it('groups images under their page and marks pageNeedsAuthors', () => {
        const pageById = new Map([
            [pageA.id, pageA],
            [pageB.id, pageB],
        ]);
        const items = buildPageAuthorWorkItems([pageA], [imgA1, imgB1], pageById);
        expect(items).toHaveLength(2);
        expect(items).toContainEqual({
            page: pageA,
            pageNeedsAuthors: true,
            pageImages: [imgA1],
        });
        expect(items).toContainEqual({
            page: pageB,
            pageNeedsAuthors: false,
            pageImages: [imgB1],
        });
    });

    it('skips work when page is missing from pageById', () => {
        const items = buildPageAuthorWorkItems([], [imgA1], new Map());
        expect(items).toEqual([]);
    });
});
