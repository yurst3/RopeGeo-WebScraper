/* eslint-disable @typescript-eslint/no-unused-vars */
import puppeteer from 'puppeteer';
import getRopewikiPageHtml from './http/getRopewikiPageHtml';
import fs from 'fs';
import parseRopewikiPage from './parsers/parseRopewikiPage';
import getRopewikiPageInfoForRegion from './http/getRopewikiPageInfoForRegion';
import { launchBrowser } from '../helpers/browserLauncher';

(async () => {
    // const pageId = process.argv[2];
    // if (!pageId) throw new Error('parse-test needs an pageId arg');

    const result = await getRopewikiPageInfoForRegion('world', 0, 20);
    fs.writeFileSync('result.json', JSON.stringify(result, null, 4))

    // const pageHTML = await getRopewikiPageHtml(pageId);

    // fs.writeFileSync('bigCreekSierraNationalForest.html', pageHTML)

    // const browser = await launchBrowser();
    // const page = await browser.newPage();
    // await page.setContent(pageHTML);

    // const { beta, images } = await parseRopewikiPage(pageHTML);

    // fs.writeFileSync('bigCreekSierraNationalForestBeta.json', JSON.stringify(beta, null, 4))
    // fs.writeFileSync('bigCreekSierraNationalForestImages.json', JSON.stringify(images, null, 4))
})()