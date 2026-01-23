import { writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Downloads the source file from a URL and saves it to a temporary directory.
 * 
 * @param sourceFileUrl - URL of the source file to download
 * @param tempDir - Temporary directory where the file should be saved
 * @param mapDataId - UUID for the map data
 * @param isKml - Whether the source file is KML (true) or GPX (false)
 * @returns Promise that resolves to an object with file path and content if successful, or error message if failed
 */
export async function downloadSourceFile(
    sourceFileUrl: string,
    tempDir: string,
    mapDataId: string,
    isKml: boolean,
): Promise<{ filePath: string | undefined; content: string | undefined; error: string | undefined }> {
    try {
        console.log(`Downloading source file from ${sourceFileUrl}...`);
        const fileExtension = isKml ? 'kml' : 'gpx';
        const sourceFileName = `${mapDataId}.${fileExtension}`;
        const sourceFilePath = join(tempDir, sourceFileName);
        
        const sourceResponse = await fetch(sourceFileUrl);
        if (!sourceResponse.ok) {
            throw new Error(`Failed to download source file: ${sourceResponse.status} ${sourceResponse.statusText}`);
        }
        const sourceFileContent = await sourceResponse.text();
        await writeFile(sourceFilePath, sourceFileContent, 'utf-8');
        return {
            filePath: sourceFilePath,
            content: sourceFileContent,
            error: undefined
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error downloading source file: ${errorMessage}`);
        return {
            filePath: undefined,
            content: undefined,
            error: `Failed to download source file: ${errorMessage}`
        };
    }
}
