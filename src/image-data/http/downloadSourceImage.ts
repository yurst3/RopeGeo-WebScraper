import { writeFile } from 'fs/promises';
import { join } from 'path';
import httpRequest from '../../helpers/httpRequest';

/**
 * Downloads an image from a URL and saves it to a temporary directory.
 * Throws on HTTP errors (e.g. 5xx) so the message can retry / go to DLQ.
 *
 * @param sourceImageUrl - URL of the image to download
 * @param tempDir - Temporary directory where the file should be saved
 * @param imageDataId - UUID for the image data (used for file name)
 * @param abortSignal - Optional AbortSignal; when aborted, the request is cancelled
 * @returns Promise that resolves to the local file path
 */
export async function downloadSourceImage(
    sourceImageUrl: string,
    tempDir: string,
    imageDataId: string,
    abortSignal?: AbortSignal,
): Promise<string> {
    const response = await httpRequest(sourceImageUrl, 5, abortSignal);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const ext = getExtensionFromUrl(sourceImageUrl) || 'jpg';
    const fileName = `${imageDataId}-source.${ext}`;
    const filePath = join(tempDir, fileName);
    await writeFile(filePath, buffer);

    return filePath;
}

function getExtensionFromUrl(url: string): string | null {
    try {
        const pathname = new URL(url).pathname;
        const match = pathname.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
        return match && match[1] !== undefined ? match[1].toLowerCase() : null;
    } catch {
        return null;
    }
}
