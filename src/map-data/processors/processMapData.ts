import { mkdtemp, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import MapData from '../types/mapData';
import type { SaveMapDataHookFn } from '../hook-functions/saveMapData';
import { downloadSourceFile } from '../http/downloadSourceFile';
import { convertToGeoJson } from '../util/convertToGeoJson';
import { convertToVectorTiles } from '../util/convertToVectorTiles';
import ProgressLogger from '../../helpers/progressLogger';

/**
 * Processes map data by downloading the source file, converting to GeoJSON and vector tiles,
 * then saving all files (e.g., upload to S3 in Lambda, or move locally in Node).
 * 
 * @param sourceFileUrl - URL of the source file (KML or GPX)
 * @param saveMapDataHookFn - Hook function to persist produced files and return URLs.
 * @param mapDataId - Optional UUID for the map data. If not provided, a new UUID will be generated.
 * @param logger - Progress logger for tracking processing progress
 * @param abortSignal - Optional AbortSignal; when aborted, the download is cancelled
 * @returns Promise that resolves to a MapData object with S3 URLs
 */
export const processMapData = async (
    sourceFileUrl: string,
    saveMapDataHookFn: SaveMapDataHookFn,
    mapDataId: string | null | undefined,
    logger: ProgressLogger,
    abortSignal?: AbortSignal,
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
            const errorMessage = `Unsupported file type. Expected .kml or .gpx, got: ${sourceFileUrl}`;
            console.error(errorMessage);
            // Return MapData with all fields undefined and error message
            return new MapData(
                undefined,
                undefined,
                undefined,
                undefined,
                finalMapDataId,
                sourceFileUrl,
                errorMessage,
            );
        }

        let errorMessage: string | undefined;

        // Step 1: Download source file
        const { filePath: sourceFilePath, content: sourceFileContent } = await downloadSourceFile(sourceFileUrl, tempDir, finalMapDataId, isKml, abortSignal);

        // Step 2: Convert to GeoJSON
        let geoJsonFilePath: string | undefined;
        const { filePath: geoJsonPath, error: geoJsonError } = await convertToGeoJson(sourceFileContent, tempDir, finalMapDataId, isKml);
        geoJsonFilePath = geoJsonPath;
        errorMessage = geoJsonError;

        // Step 3: Convert GeoJSON to vector tiles
        let vectorTileFilePath: string | undefined;
        if (geoJsonFilePath && !errorMessage) {
            const { filePath, error } = await convertToVectorTiles(geoJsonFilePath, tempDir, finalMapDataId);
            vectorTileFilePath = filePath;
            errorMessage = error;
        }

        if (abortSignal?.aborted) {
            const reason =
                abortSignal.reason instanceof Error
                    ? abortSignal.reason
                    : new Error(String(abortSignal.reason));
            throw reason;
        }

        // Save files via hook (Lambda uploads to S3; Node moves locally)
        // Hook function returns MapData object
        return await saveMapDataHookFn(
            sourceFilePath,
            geoJsonFilePath,
            vectorTileFilePath,
            finalMapDataId,
            isKml,
            sourceFileUrl,
            errorMessage,
            logger,
        );
    } finally {
        // Clean up temporary directory
        await rm(tempDir, { recursive: true, force: true });
    }
};
