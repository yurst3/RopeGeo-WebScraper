import { readdir, stat } from 'fs/promises';
import { join } from 'path';

export type PbfDirectoryCounts = {
    tileCount: number;
    tileTotalBytes: number;
};

/**
 * Recursively counts `.pbf` files under `dirPath` and sums their byte sizes.
 */
export async function countPbfFilesInDirectory(dirPath: string): Promise<PbfDirectoryCounts> {
    let tileCount = 0;
    let tileTotalBytes = 0;

    async function walk(dir: string): Promise<void> {
        const entries = await readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = join(dir, entry.name);
            if (entry.isDirectory()) {
                await walk(fullPath);
            } else if (entry.isFile() && entry.name.endsWith('.pbf')) {
                tileCount += 1;
                const fileStat = await stat(fullPath);
                tileTotalBytes += fileStat.size;
            }
        }
    }

    await walk(dirPath);
    return { tileCount, tileTotalBytes };
}
