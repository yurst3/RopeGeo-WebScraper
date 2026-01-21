import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { kml, gpx } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';
import MapData from '../types/mapData';
import type { SaveMapDataHookFn } from '../hook-functions/saveMapData';

const execAsync = promisify(exec);

/**
 * Processes map data by downloading the source file, converting to GeoJSON and vector tiles,
 * then saving all files (e.g., upload to S3 in Lambda, or move locally in Node).
 * 
 * @param sourceFileUrl - URL of the source file (KML or GPX)
 * @param saveMapDataHookFn - Hook function to persist produced files and return URLs.
 * @param mapDataId - Optional UUID for the map data. If not provided, a new UUID will be generated.
 * @returns Promise that resolves to a MapData object with S3 URLs
 */
export const processMapData = async (
    sourceFileUrl: string,
    saveMapDataHookFn: SaveMapDataHookFn,
    mapDataId?: string | null,
): Promise<MapData> => {
    // Create temporary directory for processing
    const tempDir = await mkdtemp(join(tmpdir(), 'map-data-'));
    const finalMapDataId = mapDataId ?? randomUUID();

    try {
        // Determine file type from URL
        const urlLower = sourceFileUrl.toLowerCase();
        const isKml = urlLower.endsWith('.kml');
        const isGpx = urlLower.endsWith('.gpx');
        
        if (!isKml && !isGpx) {
            throw new Error(`Unsupported file type. Expected .kml or .gpx, got: ${sourceFileUrl}`);
        }

        const fileExtension = isKml ? 'kml' : 'gpx';
        const sourceFileName = `${finalMapDataId}.${fileExtension}`;
        const sourceFilePath = join(tempDir, sourceFileName);

        // Download source file
        console.log(`Downloading source file from ${sourceFileUrl}...`);
        const sourceResponse = await fetch(sourceFileUrl);
        if (!sourceResponse.ok) {
            throw new Error(`Failed to download source file: ${sourceResponse.status} ${sourceResponse.statusText}`);
        }
        const sourceFileContent = await sourceResponse.text();
        await writeFile(sourceFilePath, sourceFileContent, 'utf-8');

        // Convert to GeoJSON
        console.log('Converting to GeoJSON...');
        const geoJsonFileName = `${finalMapDataId}.geojson`;
        const geoJsonFilePath = join(tempDir, geoJsonFileName);
        
        const dom = new DOMParser().parseFromString(sourceFileContent, 'text/xml');
        const geoJson = isKml 
            ? kml(dom)
            : gpx(dom);
        
        await writeFile(geoJsonFilePath, JSON.stringify(geoJson), 'utf-8');

        // Convert GeoJSON to vector tiles using tippecanoe
        console.log('Converting GeoJSON to vector tiles...');
        const vectorTileFileName = `${finalMapDataId}.mbtiles`;
        const vectorTileFilePath = join(tempDir, vectorTileFileName);
        
        // Find tippecanoe binary (in Lambda it's in ARTIFACTS_DIR, locally it's in PATH)
        // The Makefile copies tippecanoe to $(ARTIFACTS_DIR)/tippecanoe
        // In Lambda, ARTIFACTS_DIR becomes the handler directory
        const tippecanoePath = process.env.LAMBDA_TASK_ROOT 
            ? join(process.env.LAMBDA_TASK_ROOT, 'tippecanoe')
            : 'tippecanoe';
        
        const tippecanoeCommand = `${tippecanoePath} -o "${vectorTileFilePath}" "${geoJsonFilePath}"`;
        await execAsync(tippecanoeCommand);

        // Save files via hook (Lambda uploads to S3; Node moves locally)
        const { sourceFile, geoJsonFile, vectorTileFile } = await saveMapDataHookFn(
            sourceFilePath,
            geoJsonFilePath,
            vectorTileFilePath,
            finalMapDataId,
            isKml,
        );

        // Create and return MapData object
        const mapData = new MapData(
            isGpx ? sourceFile : undefined,
            isKml ? sourceFile : undefined,
            geoJsonFile,
            vectorTileFile,
            finalMapDataId,
        );

        return mapData;
    } finally {
        // Clean up temporary directory
        await rm(tempDir, { recursive: true, force: true });
    }
};
