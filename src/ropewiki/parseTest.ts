/* eslint-disable @typescript-eslint/no-unused-vars */
import puppeteer from 'puppeteer';
import getRopewikiPageHtml from './http/getRopewikiPageHtml';
import fs from 'fs';
import parseRopewikiPage from './parsers/parseRopewikiPage';
import getRopewikiPageInfoForRegion from './http/getRopewikiPageInfoForRegion';

// Detect if running in Lambda environment
const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME || !!process.env.LAMBDA_TASK_ROOT;
// Detect if running in GitHub Actions
const isGitHubActions = !!process.env.GITHUB_ACTIONS;

(async () => {
    // const pageId = process.argv[2];
    // if (!pageId) throw new Error('parse-test needs an pageId arg');

    const result = await getRopewikiPageInfoForRegion('world', 0, 20);
    fs.writeFileSync('result.json', JSON.stringify(result, null, 4))

    // const pageHTML = await getRopewikiPageHtml(pageId);

    // fs.writeFileSync('bigCreekSierraNationalForest.html', pageHTML)

    // const launchOptions: Parameters<typeof puppeteer.launch>[0] = {};
    
    // if (isLambda) {
    //     const chromium = await import('@sparticuz/chromium');
    //     launchOptions.args = chromium.default.args;
    //     launchOptions.executablePath = await chromium.default.executablePath();
    // } else if (isGitHubActions) {
    //     // GitHub Actions requires --no-sandbox flag
    //     launchOptions.args = ['--no-sandbox'];
    // }
    
    // const browser = await puppeteer.launch(launchOptions);
    // const page = await browser.newPage();
    // await page.setContent(pageHTML);

    // const { beta, images } = await parseRopewikiPage(pageHTML);

    // fs.writeFileSync('bigCreekSierraNationalForestBeta.json', JSON.stringify(beta, null, 4))
    // fs.writeFileSync('bigCreekSierraNationalForestImages.json', JSON.stringify(images, null, 4))
})()