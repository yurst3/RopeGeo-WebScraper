import { mkdir, rename, rm } from 'fs/promises';
import { dirname } from 'path';

/**
 * Moves a directory from sourceDir to destDir.
 * Creates the parent of destDir (recursively) if needed.
 * If destDir already exists, it is removed first.
 *
 * @param sourceDir - Path to the source directory
 * @param destDir - Path to the destination directory
 */
export async function moveDirectory(sourceDir: string, destDir: string): Promise<void> {
    await mkdir(dirname(destDir), { recursive: true });

    try {
        await rm(destDir, { recursive: true, force: true });
    } catch (err: unknown) {
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code !== 'ENOENT') {
            throw err;
        }
    }

    await rename(sourceDir, destDir);
}
