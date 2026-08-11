import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../../../src/page-zipper/util/folderBuildEnv', () => ({
    getImageBucketName: jest.fn(),
    isLocalFolderBuild: jest.fn(),
}));
jest.mock('../../../src/page-zipper/zip/appendImageEntriesToArchive', () => ({
    appendImageEntriesToArchive: jest.fn(),
}));
jest.mock('../../../src/page-zipper/zip/appendOnlineMiniMapEntriesToArchive', () => ({
    appendOnlineMiniMapEntriesToArchive: jest.fn(),
}));

import { createZipEntryWriter } from '../../../src/page-zipper/zip/createZipEntryWriter';
import {
    getImageBucketName,
    isLocalFolderBuild,
} from '../../../src/page-zipper/util/folderBuildEnv';
import { appendImageEntriesToArchive } from '../../../src/page-zipper/zip/appendImageEntriesToArchive';
import { appendOnlineMiniMapEntriesToArchive } from '../../../src/page-zipper/zip/appendOnlineMiniMapEntriesToArchive';
import { PAGE_RESPONSE_JSON } from '../../../src/page-zipper/zip/folderZipPaths';

describe('createZipEntryWriter', () => {
    const mockConn = {};
    const regionId = 'bbbbbbbb-cccc-4ddd-eeee-ffffffffffff';
    const pageJson = '{"id":"page"}';
    const view = { id: 'page', miniMap: null } as never;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.mocked(getImageBucketName).mockReturnValue('image-bucket');
        jest.mocked(isLocalFolderBuild).mockReturnValue(false);
        jest.mocked(appendImageEntriesToArchive).mockResolvedValue(undefined);
        jest.mocked(appendOnlineMiniMapEntriesToArchive).mockResolvedValue(undefined);
    });

    it('appends page JSON and asset entries in production builds', async () => {
        const append = jest.fn();
        const writeEntries = createZipEntryWriter(mockConn as never, regionId, view, pageJson, []);

        await writeEntries({ append } as never);

        expect(append).toHaveBeenCalledWith(pageJson, { name: PAGE_RESPONSE_JSON });
        expect(appendImageEntriesToArchive).toHaveBeenCalledWith({ append }, 'image-bucket', []);
        expect(appendOnlineMiniMapEntriesToArchive).toHaveBeenCalledWith(
            { append },
            mockConn,
            regionId,
            view,
        );
    });

    it('writes only page JSON for local builds', async () => {
        jest.mocked(isLocalFolderBuild).mockReturnValue(true);
        const append = jest.fn();
        const writeEntries = createZipEntryWriter(mockConn as never, regionId, view, pageJson, []);

        await writeEntries({ append } as never);

        expect(append).toHaveBeenCalledWith(pageJson, { name: PAGE_RESPONSE_JSON });
        expect(appendImageEntriesToArchive).not.toHaveBeenCalled();
        expect(appendOnlineMiniMapEntriesToArchive).not.toHaveBeenCalled();
    });
});
