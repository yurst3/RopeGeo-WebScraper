import { describe, it, expect } from '@jest/globals';
import {
    isPdf,
    getPdfPageCount,
    MultiPagePdfError,
    MULTI_PAGE_PDF_ERROR_MESSAGE,
} from '../../../src/image-data/util/pdfSource';

describe('pdfSource', () => {
    describe('isPdf', () => {
        it('returns true for buffer starting with %PDF-', () => {
            expect(isPdf(Buffer.from('%PDF-1.4\n', 'ascii'))).toBe(true);
            expect(isPdf(Buffer.from('%PDF-', 'ascii'))).toBe(true);
        });

        it('returns false for buffer too short', () => {
            expect(isPdf(Buffer.from('%PD', 'ascii'))).toBe(false);
            expect(isPdf(Buffer.alloc(0))).toBe(false);
        });

        it('returns false for non-PDF buffer', () => {
            expect(isPdf(Buffer.from('\x89PNG\r\n', 'ascii'))).toBe(false);
            expect(isPdf(Buffer.from('GIF89a', 'ascii'))).toBe(false);
            expect(isPdf(Buffer.from('  PDF-', 'ascii'))).toBe(false);
        });
    });

    describe('getPdfPageCount', () => {
        it('returns 1 for a minimal single-page PDF buffer', async () => {
            const minimalPdf = Buffer.from(
                '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%EOF',
                'ascii',
            );
            const count = await getPdfPageCount(minimalPdf);
            expect(count).toBe(1);
        });
    });

    describe('MultiPagePdfError', () => {
        it('has the expected message', () => {
            const err = new MultiPagePdfError();
            expect(err.message).toBe(MULTI_PAGE_PDF_ERROR_MESSAGE);
            expect(err.name).toBe('MultiPagePdfError');
        });
    });

    describe('MULTI_PAGE_PDF_ERROR_MESSAGE', () => {
        it('matches the user-facing error text', () => {
            expect(MULTI_PAGE_PDF_ERROR_MESSAGE).toBe(
                'Source file is a PDF with more than 1 page',
            );
        });
    });
});
