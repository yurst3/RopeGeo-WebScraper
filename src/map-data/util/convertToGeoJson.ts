import { writeFile } from 'fs/promises';
import { join } from 'path';
import { kml, gpx } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

/**
 * Converts source file content (KML or GPX) to GeoJSON format.
 * 
 * @param sourceFileContent - The content of the source file (KML or GPX XML)
 * @param tempDir - Temporary directory where the GeoJSON file should be saved
 * @param mapDataId - UUID for the map data
 * @param isKml - Whether the source file is KML (true) or GPX (false)
 * @returns Promise that resolves to the GeoJSON file path if successful, or error message if failed
 */
export async function convertToGeoJson(
    sourceFileContent: string,
    tempDir: string,
    mapDataId: string,
    isKml: boolean,
): Promise<{ filePath: string | undefined; error: string | undefined }> {
    try {
        console.log('Converting to GeoJSON...');
        const geoJsonFileName = `${mapDataId}.geojson`;
        const geoJsonFilePath = join(tempDir, geoJsonFileName);
        
        const dom = new DOMParser().parseFromString(sourceFileContent, 'text/xml');
        const geoJson = isKml 
            ? kml(dom)
            : gpx(dom);
        
        await writeFile(geoJsonFilePath, JSON.stringify(geoJson), 'utf-8');
        return {
            filePath: geoJsonFilePath,
            error: undefined
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error converting to GeoJSON: ${errorMessage}`);
        return { 
            filePath: undefined,
            error: `Failed to convert to GeoJSON: ${errorMessage}`
        };
    }
}
