import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { buildFolderPublicUrl } from '../../../../src/fargate-tasks/buildDownloadFolders/util/buildFolderPublicUrl';

describe('buildFolderPublicUrl', () => {
    let originalEnv: NodeJS.ProcessEnv;
    const pageId = 'aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee';

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('uses PAGE_ZIP_PUBLIC_BASE_URL when set', () => {
        process.env.PAGE_ZIP_PUBLIC_BASE_URL = 'https://cdn.example.com/page-zips/';

        expect(buildFolderPublicUrl(pageId)).toBe(
            `https://cdn.example.com/page-zips/${pageId}.zip`,
        );
    });

    it('falls back to S3 URL when only PAGE_ZIP_BUCKET_NAME is set', () => {
        delete process.env.PAGE_ZIP_PUBLIC_BASE_URL;
        process.env.PAGE_ZIP_BUCKET_NAME = 'my-page-zip-bucket';

        expect(buildFolderPublicUrl(pageId)).toBe(
            `https://my-page-zip-bucket.s3.amazonaws.com/${pageId}.zip`,
        );
    });

    it('throws when neither public base URL nor bucket is set', () => {
        delete process.env.PAGE_ZIP_PUBLIC_BASE_URL;
        delete process.env.PAGE_ZIP_BUCKET_NAME;

        expect(() => buildFolderPublicUrl(pageId)).toThrow(
            'PAGE_ZIP_PUBLIC_BASE_URL or PAGE_ZIP_BUCKET_NAME must be set',
        );
    });
});
