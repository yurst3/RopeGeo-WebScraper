import { describe, it, expect } from '@jest/globals';
import {
    contributorTitlesForWorkItem,
    imageAuthorUpdatesFromContributors,
    pageAuthorsFromContributors,
} from '../../../../src/fargate-tasks/backfillAttribution/util/contributorLookups';
import type { PageAuthorWorkItem } from '../../../../src/fargate-tasks/backfillAttribution/util/buildPageAuthorWorkItems';

describe('contributorLookups', () => {
    const item: PageAuthorWorkItem = {
        page: { id: 'p1', url: 'https://ropewiki.com/The_Subway' },
        pageNeedsAuthors: true,
        pageImages: [
            {
                id: 'i1',
                ropewikiPage: 'p1',
                linkUrl: 'https://ropewiki.com/File:Banner.jpg',
            },
            {
                id: 'i2',
                ropewikiPage: 'p1',
                linkUrl: 'https://ropewiki.com/File:Map.kml',
            },
        ],
    };

    it('contributorTitlesForWorkItem includes page and non-KML files', () => {
        expect(contributorTitlesForWorkItem(item)).toEqual([
            'The_Subway',
            'File:Banner.jpg',
        ]);
    });

    it('contributorTitlesForWorkItem omits page title when not needed', () => {
        expect(
            contributorTitlesForWorkItem({ ...item, pageNeedsAuthors: false }),
        ).toEqual(['File:Banner.jpg']);
    });

    it('pageAuthorsFromContributors looks up normalized titles', () => {
        const byTitle = { 'The Subway': ['Alice'] };
        expect(pageAuthorsFromContributors(byTitle, item.page.url)).toEqual(['Alice']);
    });

    it('imageAuthorUpdatesFromContributors skips KML and missing titles', () => {
        const byTitle = { 'File:Banner.jpg': ['Bob'] };
        expect(imageAuthorUpdatesFromContributors(item.pageImages, byTitle)).toEqual([
            { id: 'i1', authors: ['Bob'] },
            { id: 'i2', authors: null },
        ]);
    });
});
