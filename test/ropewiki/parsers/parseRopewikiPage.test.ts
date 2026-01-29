import { describe, it, expect } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import parseRopewikiPage from '../../../src/ropewiki/parsers/parseRopewikiPage';

describe('parseRopewikiPage', () => {
    it('parses Bear Creek Canyon HTML and matches expected beta and images', async () => {
        const htmlPath = path.join(__dirname, '..', 'data', 'bearCreekCanyon', 'bearCreekCanyon.html');
        const expectedBetaPath = path.join(__dirname, '..', 'data', 'bearCreekCanyon', 'bearCreekCanyonBeta.json');
        const expectedImagesPath = path.join(__dirname, '..', 'data', 'bearCreekCanyon', 'bearCreekCanyonImages.json');

        const html = fs.readFileSync(htmlPath, 'utf-8'); // This file shouldn't have any formatting
        const expectedBeta = JSON.parse(fs.readFileSync(expectedBetaPath, 'utf-8'));
        const expectedImages = JSON.parse(fs.readFileSync(expectedImagesPath, 'utf-8'));

        const { beta, images } = await parseRopewikiPage(html);

        expect(beta).toEqual(expectedBeta);
        expect(images).toEqual(expectedImages);
    }, 30000); // Increase timeout to 30 seconds for puppeteer

    it('parses A Glera HTML and matches expected beta with no images and empty beta sections', async () => {
        const htmlPath = path.join(__dirname, '..', 'data', 'aGlera', 'aGlera.html');
        const expectedBetaPath = path.join(__dirname, '..', 'data', 'aGlera', 'aGleraBeta.json');

        const html = fs.readFileSync(htmlPath, 'utf-8');
        const expectedBeta = JSON.parse(fs.readFileSync(expectedBetaPath, 'utf-8'));

        const { beta, images } = await parseRopewikiPage(html);

        expect(beta).toEqual(expectedBeta);
        expect(images).toEqual([]);
    }, 30000); // Increase timeout to 30 seconds for puppeteer

    it('parses Devil Gulch HTML and includes beta sections with empty text but with images', async () => {
        const htmlPath = path.join(__dirname, '..', 'data', 'devilGulch', 'devilGulch.html');
        const expectedBetaPath = path.join(__dirname, '..', 'data', 'devilGulch', 'devilGulchBeta.json');
        const expectedImagesPath = path.join(__dirname, '..', 'data', 'devilGulch', 'devilGulchImages.json');

        const html = fs.readFileSync(htmlPath, 'utf-8');
        const expectedBeta = JSON.parse(fs.readFileSync(expectedBetaPath, 'utf-8'));
        const expectedImages = JSON.parse(fs.readFileSync(expectedImagesPath, 'utf-8'));

        const { beta, images } = await parseRopewikiPage(html);

        expect(beta).toEqual(expectedBeta);
        expect(images).toEqual(expectedImages);
    }, 30000); // Increase timeout to 30 seconds for puppeteer

    it('parses Boulder Creek North HTML and preserves non-thumbnail image fileUrls', async () => {
        const htmlPath = path.join(__dirname, '..', 'data', 'boulderCreekNorth', 'boulderCreekNorth.html');
        const expectedBetaPath = path.join(__dirname, '..', 'data', 'boulderCreekNorth', 'boulderCreekNorthBeta.json');
        const expectedImagesPath = path.join(__dirname, '..', 'data', 'boulderCreekNorth', 'boulderCreekNorthImages.json');

        const html = fs.readFileSync(htmlPath, 'utf-8');
        const expectedBeta = JSON.parse(fs.readFileSync(expectedBetaPath, 'utf-8'));
        const expectedImages = JSON.parse(fs.readFileSync(expectedImagesPath, 'utf-8'));

        const { beta, images } = await parseRopewikiPage(html);

        expect(beta).toEqual(expectedBeta);
        expect(images).toEqual(expectedImages);
    }, 30000); // Increase timeout to 30 seconds for puppeteer

    it('parses Big Creek Sierra National Forest HTML and handles gallery box images with alternative layouts', async () => {
        const htmlPath = path.join(__dirname, '..', 'data', 'bigCreekSierraNationalForest', 'bigCreekSierraNationalForest.html');
        const expectedBetaPath = path.join(__dirname, '..', 'data', 'bigCreekSierraNationalForest', 'bigCreekSierraNationalForestBeta.json');
        const expectedImagesPath = path.join(__dirname, '..', 'data', 'bigCreekSierraNationalForest', 'bigCreekSierraNationalForestImages.json');

        const html = fs.readFileSync(htmlPath, 'utf-8');
        const expectedBeta = JSON.parse(fs.readFileSync(expectedBetaPath, 'utf-8'));
        const expectedImages = JSON.parse(fs.readFileSync(expectedImagesPath, 'utf-8'));

        const { beta, images } = await parseRopewikiPage(html);

        expect(beta).toEqual(expectedBeta);
        expect(images).toEqual(expectedImages);
    }, 30000); // Increase timeout to 30 seconds for puppeteer
});


