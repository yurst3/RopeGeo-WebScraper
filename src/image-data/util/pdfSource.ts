import { PDFDocument } from 'pdf-lib';

const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

/**
 * Returns true if the buffer looks like a PDF (magic bytes %PDF-).
 */
export function isPdf(buffer: Buffer): boolean {
    if (buffer.length < PDF_MAGIC.length) return false;
    return buffer.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC);
}

/**
 * Returns the number of pages in the PDF.
 * @throws if the buffer is not a valid PDF
 */
export async function getPdfPageCount(buffer: Buffer): Promise<number> {
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
    return doc.getPageCount();
}

const MULTI_PAGE_PDF_ERROR_MESSAGE =
    'Source file is a PDF with more than 1 page';

/**
 * Error thrown when the source is a multi-page PDF (we skip processing).
 */
export class MultiPagePdfError extends Error {
    constructor() {
        super(MULTI_PAGE_PDF_ERROR_MESSAGE);
        this.name = 'MultiPagePdfError';
    }
}

export { MULTI_PAGE_PDF_ERROR_MESSAGE };

/**
 * Renders the first page of the PDF at filePath to a PNG buffer.
 * Uses pdf-to-img (pdfjs-dist). In Lambda you may need a layer with canvas for this to work.
 *
 * @param filePath - Path to the PDF file on disk
 * @returns PNG buffer of the first page
 */
export async function renderPdfFirstPageToBuffer(filePath: string): Promise<Buffer> {
    const { pdf } = await import('pdf-to-img');
    const document = await pdf(filePath, { scale: 2 });
    const firstPage = await document.getPage(1);
    if (!firstPage) {
        throw new Error('Failed to render first page of PDF');
    }
    return Buffer.isBuffer(firstPage) ? firstPage : Buffer.from(firstPage);
}
