import { exec } from 'child_process';
import { promisify } from 'util';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * Converts a GeoJSON file to vector tiles using tippecanoe.
 * 
 * @param geoJsonFilePath - Path to the GeoJSON file to convert
 * @param tempDir - Temporary directory where the vector tile file should be saved
 * @param mapDataId - UUID for the map data
 * @returns Promise that resolves to the vector tile file path if successful, or error message if failed
 */
export async function convertToVectorTiles(
    geoJsonFilePath: string,
    tempDir: string,
    mapDataId: string,
): Promise<{ filePath: string | undefined; error: string | undefined }> {
    try {
        console.log('Converting GeoJSON to vector tiles...');
        const vectorTileFileName = `${mapDataId}.mbtiles`;
        const vectorTileFilePath = join(tempDir, vectorTileFileName);
        
        // Find tippecanoe binary (in Lambda it's in ARTIFACTS_DIR, locally it's in PATH)
        // The Makefile copies tippecanoe to $(ARTIFACTS_DIR)/tippecanoe
        // In Lambda, ARTIFACTS_DIR becomes the handler directory
        const tippecanoePath = process.env.LAMBDA_TASK_ROOT 
            ? join(process.env.LAMBDA_TASK_ROOT, 'tippecanoe')
            : 'tippecanoe';
        
        const tippecanoeCommand = `${tippecanoePath} -o "${vectorTileFilePath}" "${geoJsonFilePath}"`;
        await execAsync(tippecanoeCommand);
        return {
            filePath: vectorTileFilePath,
            error: undefined,
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error converting to vector tiles: ${errorMessage}`);
        return {
            filePath: undefined,
            error: `Failed to convert to vector tiles: ${errorMessage}`,
        };
    }
}
