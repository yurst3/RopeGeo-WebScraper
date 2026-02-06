import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import moveFile from '../../../src/map-data/util/moveFile';

const mockMkdir = jest.fn<() => Promise<void>>();
const mockUnlink = jest.fn<() => Promise<void>>();
const mockRename = jest.fn<() => Promise<void>>();
const mockCopyFile = jest.fn<() => Promise<void>>();
const mockDirname = jest.fn<(path: string) => string>();

jest.mock('fs/promises', () => ({
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    unlink: (...args: unknown[]) => mockUnlink(...args),
    rename: (...args: unknown[]) => mockRename(...args),
    copyFile: (...args: unknown[]) => mockCopyFile(...args),
}));

jest.mock('path', () => ({
    dirname: (path: string) => mockDirname(path),
}));

describe('moveFile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockDirname.mockImplementation((path: string) => path.split('/').slice(0, -1).join('/'));
        mockMkdir.mockResolvedValue(undefined);
        mockUnlink.mockResolvedValue(undefined);
        mockRename.mockResolvedValue(undefined);
    });

    it('creates dest directory, unlinks dest if present, then renames source to dest', async () => {
        const sourcePath = '/tmp/source.kml';
        const destPath = '/project/.savedMapData/source/id.kml';

        await moveFile(sourcePath, destPath);

        expect(mockDirname).toHaveBeenCalledWith(destPath);
        expect(mockMkdir).toHaveBeenCalledWith('/project/.savedMapData/source', { recursive: true });
        expect(mockUnlink).toHaveBeenCalledWith(destPath);
        expect(mockRename).toHaveBeenCalledWith(sourcePath, destPath);
        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('ignores ENOENT when unlinking dest and proceeds to rename', async () => {
        const sourcePath = '/tmp/source.kml';
        const destPath = '/project/.savedMapData/source/id.kml';
        const enoentError = new Error('No such file') as NodeJS.ErrnoException;
        enoentError.code = 'ENOENT';

        mockUnlink.mockRejectedValueOnce(enoentError);

        await moveFile(sourcePath, destPath);

        expect(mockUnlink).toHaveBeenCalledWith(destPath);
        expect(mockRename).toHaveBeenCalledWith(sourcePath, destPath);
        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('propagates non-ENOENT error when unlinking dest', async () => {
        const sourcePath = '/tmp/source.kml';
        const destPath = '/project/.savedMapData/source/id.kml';
        const epermError = new Error('Permission denied') as NodeJS.ErrnoException;
        epermError.code = 'EPERM';

        mockUnlink.mockRejectedValueOnce(epermError);

        await expect(moveFile(sourcePath, destPath)).rejects.toThrow('Permission denied');
        expect(mockRename).not.toHaveBeenCalled();
    });

    it('falls back to copyFile then unlink(source) when rename throws EXDEV', async () => {
        const sourcePath = '/tmp/source.kml';
        const destPath = '/project/.savedMapData/source/id.kml';
        const exdevError = new Error('Cross-device link not permitted') as NodeJS.ErrnoException;
        exdevError.code = 'EXDEV';

        mockRename.mockRejectedValueOnce(exdevError);

        await moveFile(sourcePath, destPath);

        expect(mockCopyFile).toHaveBeenCalledWith(sourcePath, destPath);
        expect(mockUnlink).toHaveBeenCalledTimes(2); // once for dest (before rename), once for source (after copy)
        expect(mockUnlink).toHaveBeenNthCalledWith(1, destPath);
        expect(mockUnlink).toHaveBeenNthCalledWith(2, sourcePath);
    });

    it('propagates non-EXDEV error when rename fails', async () => {
        const sourcePath = '/tmp/source.kml';
        const destPath = '/project/.savedMapData/source/id.kml';
        const otherError = new Error('Rename failed') as NodeJS.ErrnoException;
        otherError.code = 'EISDIR';

        mockRename.mockRejectedValueOnce(otherError);

        await expect(moveFile(sourcePath, destPath)).rejects.toThrow('Rename failed');
        expect(mockCopyFile).not.toHaveBeenCalled();
    });

    it('calls mkdir with dirname(destPath) and recursive true', async () => {
        const destPath = '/a/b/c/file.geojson';
        mockDirname.mockReturnValueOnce('/a/b/c');

        await moveFile('/tmp/file.geojson', destPath);

        expect(mockDirname).toHaveBeenCalledWith(destPath);
        expect(mockMkdir).toHaveBeenCalledWith('/a/b/c', { recursive: true });
    });
});
