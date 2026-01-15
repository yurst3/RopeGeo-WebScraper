import { launchBrowser } from '../../helpers/browserLauncher'

const parseCanyonsPage = async (pageHtml: string): Promise<string[]> => {
    const browser = await launchBrowser();
    const page = await browser.newPage();

    await page.setContent(pageHtml);

    return[]
}

export default parseCanyonsPage;