import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import type { Archiver } from 'archiver';

type CreateArchiver = (format: string, options?: object) => Archiver;
const createArchiver = require('archiver') as CreateArchiver;

export async function writeZipToFile(
    destPath: string,
    writeEntries: (archive: Archiver) => Promise<void>,
): Promise<void> {
    await mkdir(dirname(destPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
        const output = createWriteStream(destPath);
        const archive = createArchiver('zip', { zlib: { level: 9 } });
        output.on('close', () => resolve());
        output.on('error', reject);
        archive.on('error', reject);
        archive.pipe(output);
        writeEntries(archive)
            .then(() => archive.finalize())
            .catch(reject);
    });
}
