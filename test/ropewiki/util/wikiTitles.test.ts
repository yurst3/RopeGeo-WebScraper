import { describe, it, expect } from '@jest/globals';
import {
    fileTitleFromLinkUrl,
    isKmlFileTitle,
    lookupContributors,
    normalizeWikiTitleKey,
    wikiTitleFromPageUrl,
} from '../../../src/ropewiki/util/wikiTitles';

describe('wikiTitles', () => {
    it('wikiTitleFromPageUrl extracts path title', () => {
        expect(wikiTitleFromPageUrl('https://ropewiki.com/Ferriere_(Reunion)')).toBe(
            'Ferriere_(Reunion)',
        );
    });

    it('fileTitleFromLinkUrl extracts File title', () => {
        expect(
            fileTitleFromLinkUrl('https://ropewiki.com/File:Birks_Banner.jpg'),
        ).toBe('File:Birks_Banner.jpg');
    });

    it('fileTitleFromLinkUrl prefixes File: when path has no namespace', () => {
        expect(fileTitleFromLinkUrl('https://ropewiki.com/Birks_Banner.jpg')).toBe(
            'File:Birks_Banner.jpg',
        );
    });

    it('fileTitleFromLinkUrl returns null for invalid URLs', () => {
        expect(fileTitleFromLinkUrl('not a url')).toBeNull();
    });

    it('wikiTitleFromPageUrl throws for empty path', () => {
        expect(() => wikiTitleFromPageUrl('https://ropewiki.com/')).toThrow(
            'Could not derive wiki title from page URL',
        );
    });

    it('isKmlFileTitle detects kml', () => {
        expect(isKmlFileTitle('File:The_Subway.kml')).toBe(true);
        expect(isKmlFileTitle('File:The_Subway.KML')).toBe(true);
        expect(isKmlFileTitle('File:pic.jpg')).toBe(false);
    });

    it('lookupContributors matches normalized underscore/space titles', () => {
        const byTitle = {
            'File:The Subway.kml': ['Bjp'],
        };
        expect(lookupContributors(byTitle, 'File:The_Subway.kml')).toEqual(['Bjp']);
        expect(normalizeWikiTitleKey('File:The_Subway.kml')).toBe(
            'file:the subway.kml',
        );
    });
});
