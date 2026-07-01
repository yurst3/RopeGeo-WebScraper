import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
    getImageBucketName,
    getMapDataBucketName,
    getPageZipBucketName,
    isLocalFolderBuild,
} from '../../../../src/fargate-tasks/buildDownloadFolders/util/folderBuildEnv';

describe('folderBuildEnv', () => {
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
        originalEnv = process.env;
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('getPageZipBucketName', () => {
        it('returns PAGE_ZIP_BUCKET_NAME from env', () => {
            process.env.PAGE_ZIP_BUCKET_NAME = ' page-zip-bucket ';

            expect(getPageZipBucketName()).toBe('page-zip-bucket');
        });

        it('throws when PAGE_ZIP_BUCKET_NAME is not set', () => {
            delete process.env.PAGE_ZIP_BUCKET_NAME;

            expect(() => getPageZipBucketName()).toThrow(
                'PAGE_ZIP_BUCKET_NAME environment variable is not set',
            );
        });
    });

    describe('getImageBucketName', () => {
        it('returns IMAGE_BUCKET_NAME from env', () => {
            process.env.IMAGE_BUCKET_NAME = 'image-bucket';

            expect(getImageBucketName()).toBe('image-bucket');
        });

        it('throws when IMAGE_BUCKET_NAME is not set', () => {
            delete process.env.IMAGE_BUCKET_NAME;

            expect(() => getImageBucketName()).toThrow(
                'IMAGE_BUCKET_NAME environment variable is not set',
            );
        });
    });

    describe('getMapDataBucketName', () => {
        it('returns MAP_DATA_BUCKET_NAME from env', () => {
            process.env.MAP_DATA_BUCKET_NAME = 'map-data-bucket';

            expect(getMapDataBucketName()).toBe('map-data-bucket');
        });

        it('throws when MAP_DATA_BUCKET_NAME is not set', () => {
            delete process.env.MAP_DATA_BUCKET_NAME;

            expect(() => getMapDataBucketName()).toThrow(
                'MAP_DATA_BUCKET_NAME environment variable is not set',
            );
        });
    });

    describe('isLocalFolderBuild', () => {
        it('returns true when DEV_ENVIRONMENT is local', () => {
            process.env.DEV_ENVIRONMENT = 'local';

            expect(isLocalFolderBuild()).toBe(true);
        });

        it('returns false for other environments', () => {
            process.env.DEV_ENVIRONMENT = 'production';

            expect(isLocalFolderBuild()).toBe(false);
        });
    });
});
