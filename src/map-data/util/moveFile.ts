import { copyFile, mkdir, rename, unlink } from 'fs/promises';
import { dirname } from 'path';

/**
 * Moves a file from sourcePath to destPath.
 * Creates the destination directory (recursively) if needed.
 * Overwrites destPath if it already exists.
 * If rename fails with EXDEV (cross-device), falls back to copy then unlink.
 *
 * @param sourcePath - Path to the source file
 * @param destPath - Path to the destination file
 */
async function moveFile(sourcePath: string, destPath: string): Promise<void> {
    await mkdir(dirname(destPath), { recursive: true });

    // Remove destination file if it exists to ensure overwrite
    try {
        await unlink(destPath);
    } catch (err: unknown) {
        // Ignore error if file doesn't exist (ENOENT)
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code !== 'ENOENT') {
            throw err;
        }
    }

    try {
        await rename(sourcePath, destPath);
    } catch (err: unknown) {
        // Cross-device rename can fail (EXDEV); fall back to copy+unlink.
        const code = (err as NodeJS.ErrnoException)?.code;
        if (code === 'EXDEV') {
            await copyFile(sourcePath, destPath);
            await unlink(sourcePath);
            return;
        }
        throw err;
    }
}

export default moveFile;
