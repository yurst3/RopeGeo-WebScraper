import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { RopewikiBetaSection, RopewikiImage } from '../types/ropewiki';
import uniqBy from 'lodash/uniqBy';

const evalPage = (): { beta: RopewikiBetaSection[], images: RopewikiImage[] } => {
    // Functions have to be defined inside evalPage() because it is being run in a browser context and can't reference other functions
    const getHeaderTitle = (childNodes: NodeListOf<ChildNode>): string | undefined => {
        for (let i = 0; i < childNodes.length; i++) {
            const child: ChildNode | undefined = childNodes[i];
            if (child && child.textContent && child.textContent.length > 0) return child.textContent;
        }
    }

    let currentBeta: RopewikiBetaSection | null = null;
    const parseChildNodes = (childNodes: NodeListOf<ChildNode>) => {
        childNodes.forEach((child: ChildNode) => {
            switch (child.nodeName) {
                case 'H2':
                    // Start of a new beta section
                    if (currentBeta) beta.push(currentBeta);
                    const title = getHeaderTitle(child.childNodes); // eslint-disable-line no-case-declarations
                    currentBeta = title ? { title, text: '' } : null;
                    break;
                case 'A':
                case 'B':
                case 'I':
                case 'P':
                case 'S':
                case 'U':
                case 'FONT':
                    if (!currentBeta) break;
                    currentBeta.text += (child as Element).outerHTML;
                    break;
                case '#text':
                    if (!currentBeta) break;
                    if (child.nodeValue !== '\n') currentBeta.text += child.nodeValue;
                    break;
                case 'LI':
                    if (!currentBeta) break;
                    if ((child as Element).className === 'gallerybox') parseGalleryBoxImage((child as Element));
                    else {
                        currentBeta.text += '<li>';
                        // We want to exclude things like images from being included in the html text, so recursively call this function instead of .outerHtml
                        parseChildNodes(child.childNodes);
                        currentBeta.text += '</li>\n';
                    }
                    break;
                case 'UL':
                    if (!currentBeta) break;
                    if ((child as Element).className !== 'gallery') currentBeta.text += '<ul>';
                    parseChildNodes(child.childNodes);
                    if ((child as Element).className !== 'gallery') currentBeta.text += '</ul>\n';
                    break;
                case 'DIV':
                    if ((child as Element).id === 'referencepic') parseChildNodes(child.childNodes);
                    break;
                default:
                    break;
            }
        });
    }

    const parseGalleryBoxCaption = (childNodes: NodeListOf<ChildNode> | undefined): string => {
        if (!childNodes) return '';

        let caption = '';
        childNodes.forEach((child: ChildNode) => {
            switch (child.nodeName) {
                case 'DIV':
                    break; // We want to ignore the "magnify" button in the caption
                case '#text':
                    caption += child.nodeValue;
                    break;
                default:
                    caption += (child as Element).outerHTML;
                    break;
            }
        });
        return caption;
    }

    const getImageFileUri = (imageElement: Element | null | undefined) => {
        // Example: /images/thumb/d/d4/Bear_Creek_Canyon_pic01.jpg/135px-Bear_Creek_Canyon_pic01.jpg
        let fileUri: string | undefined = imageElement?.attributes
            .getNamedItem('src')
            ?.value;

        const isThumbnailFile: boolean | undefined = fileUri?.includes('thumb');

        if (isThumbnailFile) {
            fileUri = fileUri?.split('/')
                ?.filter(pathItem => pathItem !== 'thumb')
                ?.slice(0, -1)
                ?.join('/');
        }

        return fileUri;
    }

    const attachDomain = (uri: string): string => {
        if (uri[0] === '/') return 'https://ropewiki.com' + uri;
        return uri;
    }

    const parseGalleryBoxImage = (element: Element) => {
        const imageParent = element.querySelector('.thumbinner') ?? element.querySelector('.thumb')?.children[0];
        const captionParent = element.querySelector('.thumbcaption') ?? element.querySelector('.gallerytext');

        // Example: /File:Bear_Creek_Canyon_pic01.jpg
        const linkUri: string | undefined = imageParent
            ?.children[0]
            ?.attributes
            .getNamedItem('href')
            ?.value;

        const imageElement = imageParent
            ?.children[0]
            ?.children[0];

        // Example: /images/8/80/Bear_Creek_Canyon_Banner.jpg
        const fileUri: string | undefined = getImageFileUri(imageElement);

        const caption = parseGalleryBoxCaption(captionParent?.childNodes);

        if (linkUri && fileUri) {
            images.push({
                betaSectionTitle: currentBeta?.title,
                linkUrl: attachDomain(linkUri),
                fileUrl: attachDomain(fileUri),
                caption,
            });
        }
    }

    const parseBannerImage = () => {
        // If there is an "add-photo element, there is no banner image for this page
        if (document.getElementsByClassName('pops add-photo').length) return;

        const bannerImage: Element | null | undefined = document.querySelector('.tablecanyon')
            ?.querySelector('img');
        const bannerAnchor: Element | null | undefined = bannerImage?.parentElement;

        const linkUri = bannerAnchor?.attributes
            .getNamedItem('href')
            ?.value;

        const fileUri = getImageFileUri(bannerImage);

        if (linkUri && fileUri) {
            images.push({
                betaSectionTitle: undefined,
                linkUrl: attachDomain(linkUri),
                fileUrl: attachDomain(fileUri),
                caption: undefined,
            });
        }
    }

    const beta: RopewikiBetaSection[] = [];
    const images: RopewikiImage[] = [];

    const parent: Element | null = document.querySelector('.mw-parser-output');
    if (parent === null) return { beta, images };

    parseBannerImage();
    parseChildNodes(parent.childNodes);
    if (currentBeta) beta.push(currentBeta);


    return { beta, images };
}

// Aberfoyle Canyon has duplicate "Background" beta sections, however both are empty
const removeDuplicates = (
    result: { beta: RopewikiBetaSection[], images: RopewikiImage[] }
): { beta: RopewikiBetaSection[], images: RopewikiImage[] } => {
    return {
        beta: uniqBy(result.beta, 'title'),
        images: uniqBy(result.images, image => `${image.betaSectionTitle}-${image.fileUrl}`)
    }
}

// See Devil Gulch test data and unit test
const removeEmptyBetaSectionsWithoutImages = (
    result: { beta: RopewikiBetaSection[], images: RopewikiImage[] }
): { beta: RopewikiBetaSection[], images: RopewikiImage[] } => {
    const imageBetaSectionTitles: Set<string | undefined> = new Set(
        result.images.map(image => image.betaSectionTitle)
    );

    const beta: RopewikiBetaSection[] = result.beta.filter(betaSection => {
        const isEmpty: boolean = betaSection.text.length === 0;
        const hasImage: boolean = imageBetaSectionTitles.has(betaSection.title);
        if (isEmpty && !hasImage) return false;
        return true;
    });

    return { beta, images: result.images };
}

const parseRopewikiPage = async (html: string) => {
    const browser = await puppeteer.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
    });
    const page = await browser.newPage();
    await page.setContent(html);

    let result = await page.evaluate(evalPage);

    await browser.close();

    result = removeEmptyBetaSectionsWithoutImages(result);
    result = removeDuplicates(result);

    return result;
}

export default parseRopewikiPage;