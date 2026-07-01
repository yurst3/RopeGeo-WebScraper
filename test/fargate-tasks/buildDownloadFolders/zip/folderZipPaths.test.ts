import { describe, it, expect } from '@jest/globals';
import {
    folderZipFileName,
    PAGE_RESPONSE_JSON,
    SAVED_DOWNLOAD_FOLDERS_DIR,
    ZIP_CONTENT_TYPE,
    zipStorePath,
} from '../../../../src/fargate-tasks/buildDownloadFolders/zip/folderZipPaths';

describe('folderZipPaths', () => {
    it('exports expected constants', () => {
        expect(PAGE_RESPONSE_JSON).toBe('page-response.json');
        expect(SAVED_DOWNLOAD_FOLDERS_DIR).toBe('.savedDownloadFolders');
        expect(ZIP_CONTENT_TYPE).toBe('application/zip');
    });

    describe('folderZipFileName', () => {
        it('returns pageId with .zip extension', () => {
            expect(folderZipFileName('page-123')).toBe('page-123.zip');
        });
    });

    describe('zipStorePath', () => {
        it('returns true for .avif and .pbf paths', () => {
            expect(zipStorePath('images/x/banner.avif')).toBe(true);
            expect(zipStorePath('tiles/x/0/0/0.pbf')).toBe(true);
        });

        it('returns false for other extensions', () => {
            expect(zipStorePath('page-response.json')).toBe(false);
            expect(zipStorePath('routes/region.geojson')).toBe(false);
        });
    });
});
