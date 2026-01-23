import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { convertToGeoJson } from '../../../src/map-data/util/convertToGeoJson';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { kml, gpx } from '@tmcw/togeojson';
import { DOMParser } from '@xmldom/xmldom';

// Mock fs/promises
jest.mock('fs/promises', () => ({
    writeFile: jest.fn(),
}));

// Mock @tmcw/togeojson
const mockKml = jest.fn();
const mockGpx = jest.fn();
jest.mock('@tmcw/togeojson', () => ({
    kml: (dom: any) => mockKml(dom),
    gpx: (dom: any) => mockGpx(dom),
}));

// Mock @xmldom/xmldom
const mockParseFromString = jest.fn<(text: string, mimeType: string) => any>();
jest.mock('@xmldom/xmldom', () => ({
    DOMParser: jest.fn(() => ({
        parseFromString: mockParseFromString,
    })),
}));

describe('convertToGeoJson', () => {
    const mockTempDir = '/tmp/map-data-abc123';
    const mockMapDataId = '11111111-1111-1111-1111-111111111111';
    const mockSourceFileContent = '<?xml version="1.0"?><kml></kml>';
    const mockGeoJson = { type: 'FeatureCollection', features: [] };
    const mockDom = { mock: 'dom' };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('successfully converts KML content to GeoJSON', async () => {
        mockParseFromString.mockReturnValue(mockDom as any);
        mockKml.mockReturnValue(mockGeoJson);
        (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

        const result = await convertToGeoJson(mockSourceFileContent, mockTempDir, mockMapDataId, true);

        expect(result).toEqual({
            filePath: join(mockTempDir, `${mockMapDataId}.geojson`),
            error: undefined,
        });
        expect(mockParseFromString).toHaveBeenCalledTimes(1);
        expect(mockParseFromString).toHaveBeenCalledWith(mockSourceFileContent, 'text/xml');
        expect(mockKml).toHaveBeenCalledTimes(1);
        expect(mockKml).toHaveBeenCalledWith(mockDom);
        expect(mockGpx).not.toHaveBeenCalled();
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(
            join(mockTempDir, `${mockMapDataId}.geojson`),
            JSON.stringify(mockGeoJson),
            'utf-8',
        );
    });

    it('successfully converts GPX content to GeoJSON', async () => {
        mockParseFromString.mockReturnValue(mockDom as any);
        mockGpx.mockReturnValue(mockGeoJson);
        (writeFile as jest.MockedFunction<typeof writeFile>).mockResolvedValue(undefined);

        const result = await convertToGeoJson(mockSourceFileContent, mockTempDir, mockMapDataId, false);

        expect(result).toEqual({
            filePath: join(mockTempDir, `${mockMapDataId}.geojson`),
            error: undefined,
        });
        expect(mockParseFromString).toHaveBeenCalledTimes(1);
        expect(mockParseFromString).toHaveBeenCalledWith(mockSourceFileContent, 'text/xml');
        expect(mockGpx).toHaveBeenCalledTimes(1);
        expect(mockGpx).toHaveBeenCalledWith(mockDom);
        expect(mockKml).not.toHaveBeenCalled();
        expect(writeFile).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledWith(
            join(mockTempDir, `${mockMapDataId}.geojson`),
            JSON.stringify(mockGeoJson),
            'utf-8',
        );
    });

    it('returns error when DOMParser.parseFromString throws an error', async () => {
        const parseError = new Error('XML parsing error');
        mockParseFromString.mockImplementation(() => {
            throw parseError;
        });

        const result = await convertToGeoJson(mockSourceFileContent, mockTempDir, mockMapDataId, true);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to GeoJSON: XML parsing error',
        });
        expect(mockParseFromString).toHaveBeenCalledTimes(1);
        expect(mockKml).not.toHaveBeenCalled();
        expect(mockGpx).not.toHaveBeenCalled();
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('returns error when kml conversion throws an error', async () => {
        mockParseFromString.mockReturnValue(mockDom as any);
        const kmlError = new Error('KML conversion error');
        mockKml.mockImplementation(() => {
            throw kmlError;
        });

        const result = await convertToGeoJson(mockSourceFileContent, mockTempDir, mockMapDataId, true);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to GeoJSON: KML conversion error',
        });
        expect(mockParseFromString).toHaveBeenCalledTimes(1);
        expect(mockKml).toHaveBeenCalledTimes(1);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('returns error when gpx conversion throws an error', async () => {
        mockParseFromString.mockReturnValue(mockDom as any);
        const gpxError = new Error('GPX conversion error');
        mockGpx.mockImplementation(() => {
            throw gpxError;
        });

        const result = await convertToGeoJson(mockSourceFileContent, mockTempDir, mockMapDataId, false);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to GeoJSON: GPX conversion error',
        });
        expect(mockParseFromString).toHaveBeenCalledTimes(1);
        expect(mockGpx).toHaveBeenCalledTimes(1);
        expect(writeFile).not.toHaveBeenCalled();
    });

    it('returns error when writeFile throws an error', async () => {
        mockParseFromString.mockReturnValue(mockDom as any);
        mockKml.mockReturnValue(mockGeoJson);
        const writeError = new Error('File system error');
        (writeFile as jest.MockedFunction<typeof writeFile>).mockRejectedValue(writeError);

        const result = await convertToGeoJson(mockSourceFileContent, mockTempDir, mockMapDataId, true);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to GeoJSON: File system error',
        });
        expect(mockParseFromString).toHaveBeenCalledTimes(1);
        expect(mockKml).toHaveBeenCalledTimes(1);
        expect(writeFile).toHaveBeenCalledTimes(1);
    });

    it('handles non-Error thrown values', async () => {
        mockParseFromString.mockReturnValue(mockDom as any);
        mockKml.mockImplementation(() => {
            throw 'String error';
        });

        const result = await convertToGeoJson(mockSourceFileContent, mockTempDir, mockMapDataId, true);

        expect(result).toEqual({
            filePath: undefined,
            error: 'Failed to convert to GeoJSON: String error',
        });
    });
});
