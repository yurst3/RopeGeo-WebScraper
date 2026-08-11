import { describe, it, expect } from '@jest/globals';
import type * as s from 'zapatos/schema';
import PageZipperJob from '../../../src/page-zipper/types/pageZipperJob';

function makeRow(
    overrides: Partial<s.PageZipperJob.JSONSelectable> = {},
): s.PageZipperJob.JSONSelectable {
    return {
        id: 'job-1',
        pageId: 'page-1',
        pageSource: 'ropewiki',
        pageReady: true,
        pageHasMapData: false,
        mapDataId: null,
        imageDataReady: {},
        mapDataLegendItemsReady: null,
        createdAt: '2025-01-01T00:00:00' as s.PageZipperJob.JSONSelectable['createdAt'],
        updatedAt: '2025-01-01T00:00:00' as s.PageZipperJob.JSONSelectable['updatedAt'],
        ...overrides,
    };
}

describe('PageZipperJob.readyToEnqueueMessage', () => {
    it('returns false when pageReady is false', () => {
        const job = PageZipperJob.fromDbRow(makeRow({ pageReady: false }));
        expect(job.readyToEnqueueMessage()).toBe(false);
    });

    it('returns false when imageDataReady is null', () => {
        const job = PageZipperJob.fromDbRow(makeRow({ imageDataReady: null }));
        expect(job.readyToEnqueueMessage()).toBe(false);
    });

    it('returns false when any image key is false', () => {
        const job = PageZipperJob.fromDbRow(
            makeRow({ imageDataReady: { a: true, b: false } }),
        );
        expect(job.readyToEnqueueMessage()).toBe(false);
    });

    it('returns true when page has no map data and images are ready', () => {
        const job = PageZipperJob.fromDbRow(
            makeRow({
                pageHasMapData: false,
                imageDataReady: { a: true },
            }),
        );
        expect(job.readyToEnqueueMessage()).toBe(true);
    });

    it('treats empty imageDataReady as ready', () => {
        const job = PageZipperJob.fromDbRow(
            makeRow({ pageHasMapData: false, imageDataReady: {} }),
        );
        expect(job.readyToEnqueueMessage()).toBe(true);
    });

    it('returns false when pageHasMapData and mapDataId is missing', () => {
        const job = PageZipperJob.fromDbRow(
            makeRow({
                pageHasMapData: true,
                mapDataId: null,
                imageDataReady: {},
                mapDataLegendItemsReady: {},
            }),
        );
        expect(job.readyToEnqueueMessage()).toBe(false);
    });

    it('returns false when map legend readiness is null', () => {
        const job = PageZipperJob.fromDbRow(
            makeRow({
                pageHasMapData: true,
                mapDataId: 'map-1',
                imageDataReady: {},
                mapDataLegendItemsReady: null,
            }),
        );
        expect(job.readyToEnqueueMessage()).toBe(false);
    });

    it('returns false when any legend key is false', () => {
        const job = PageZipperJob.fromDbRow(
            makeRow({
                pageHasMapData: true,
                mapDataId: 'map-1',
                imageDataReady: {},
                mapDataLegendItemsReady: { s1: true, s2: false },
            }),
        );
        expect(job.readyToEnqueueMessage()).toBe(false);
    });

    it('returns true when page, images, and legend readiness are all satisfied', () => {
        const job = PageZipperJob.fromDbRow(
            makeRow({
                pageHasMapData: true,
                mapDataId: 'map-1',
                imageDataReady: { img: true },
                mapDataLegendItemsReady: { s1: true },
            }),
        );
        expect(job.readyToEnqueueMessage()).toBe(true);
    });

    it('treats empty mapDataLegendItemsReady as ready when map data is present', () => {
        const job = PageZipperJob.fromDbRow(
            makeRow({
                pageHasMapData: true,
                mapDataId: 'map-1',
                imageDataReady: {},
                mapDataLegendItemsReady: {},
            }),
        );
        expect(job.readyToEnqueueMessage()).toBe(true);
    });
});

describe('PageZipperJob.toMessage', () => {
    it('returns id, pageId, and pageSource for SQS enqueue', () => {
        const job = PageZipperJob.fromDbRow(makeRow({
            id: 'job-9',
            pageId: 'page-9',
            pageSource: 'ropewiki',
        }));
        expect(job.toMessage()).toEqual({
            id: 'job-9',
            pageId: 'page-9',
            pageSource: 'ropewiki',
        });
    });
});
