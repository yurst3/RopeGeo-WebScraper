import { writeFile } from 'fs/promises';
import { join } from 'path';
import httpRequest from '../../helpers/httpRequest';

/**
 * Downloads the source file from a URL and saves it to a temporary directory.
 *
 * @param sourceFileUrl - URL of the source file to download
 * @param tempDir - Temporary directory where the file should be saved
 * @param mapDataId - UUID for the map data
 * @param isKml - Whether the source file is KML (true) or GPX (false)
 * @returns Promise that resolves to an object with file path and content
 * @throws Error if the source file cannot be downloaded
 */
export async function downloadSourceFile(
    sourceFileUrl: string,
    tempDir: string,
    mapDataId: string,
    isKml: boolean,
): Promise<{ filePath: string; content: string }> {
    const fileExtension = isKml ? 'kml' : 'gpx';
    const sourceFileName = `${mapDataId}.${fileExtension}`;
    const sourceFilePath = join(tempDir, sourceFileName);

    const sourceResponse = await httpRequest(sourceFileUrl);
    const sourceFileContent = await sourceResponse.text();
    await writeFile(sourceFilePath, sourceFileContent, 'utf-8');
    
    return {
        filePath: sourceFilePath,
        content: sourceFileContent,
    };
}
