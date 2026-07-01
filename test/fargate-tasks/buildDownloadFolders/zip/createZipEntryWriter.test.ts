import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/util/folderBuildEnv', () => ({
    getImageBucketName: jest.fn(),
    isLocalFolderBuild: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/zip/appendImageEntriesToArchive', () => ({
    appendImageEntriesToArchive: jest.fn(),
}));
jest.mock('../../../../src/fargate-tasks/buildDownloadFolders/zip/appendOnlineMiniMapEntriesToArchive', () => ({
    appendOnlineMiniMapEntriesToArchive: jest.fn(),
}));

import { createZipEntryWriter } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/createZipEntryWriter';
import {
    getImageBucketName,
    isLocalFolderBuild,
} from '../../../../src/fargate-tasks/buildDownloadFolders/util/folderBuildEnv';
import { appendImageEntriesToArchive } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/appendImageEntriesToArchive';
import { appendOnlineMiniMapEntriesToArchive } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/appendOnlineMiniMapEntriesToArchive';
import { PAGE_RESPONSE_JSON } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/folderZipPaths';

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
