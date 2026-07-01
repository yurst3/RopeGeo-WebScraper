import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { describe, it, expect, afterEach } from '@jest/globals';
import type { Archiver } from 'archiver';
import { writeZipToFile } from '../../../../src/fargate-tasks/buildDownloadFolders/zip/writeZipToFile';

describe('writeZipToFile', () => {
    let tempDir: string;

    afterEach(async () => {
        if (tempDir) {
            await rm(tempDir, { recursive: true, force: true });
        }
    });

    it('writes archive entries to a zip file on disk', async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'buildDownloadFolders-zip-'));
        const destPath = join(tempDir, 'nested', 'bundle.zip');

        await writeZipToFile(destPath, async (archive: Archiver) => {
            archive.append('{"id":"page"}', { name: 'page-response.json' });
        });

        const bytes = await readFile(destPath);
        expect(bytes.length).toBeGreaterThan(0);
        expect(bytes[0]).toBe(0x50);
        expect(bytes[1]).toBe(0x4b);
    });
});
