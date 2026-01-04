/* eslint-disable @typescript-eslint/no-unused-vars */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import getRopewikiPageHtml from './http/getRopewikiPageHtml';
import fs from 'fs';
import parseRopewikiPage from './parsers/parseRopewikiPage';

(async () => {
    const pageId = process.argv[2];
    if (!pageId) throw new Error('parse-test needs an pageId arg');
    const pageHTML = await getRopewikiPageHtml(pageId);

    // fs.writeFileSync('bigCreekSierraNationalForest.html', pageHTML)

    const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
    });
    const page = await browser.newPage();
    await page.setContent(pageHTML);

    // const { beta, images } = await parseRopewikiPage(pageHTML);

    // fs.writeFileSync('bigCreekSierraNationalForestBeta.json', JSON.stringify(beta, null, 4))
    // fs.writeFileSync('bigCreekSierraNationalForestImages.json', JSON.stringify(images, null, 4))
})()