import { describe, it, expect } from '@jest/globals';
import ImageData from '../../../src/image-data/types/imageData';
import { ImageVersion } from 'ropegeo-common';
import { Metadata, Orientation } from '../../../src/image-data/types/metadata';
import type * as s from 'zapatos/schema';
import type * as db from 'zapatos/db';

describe('ImageData', () => {
    it('constructs with optional args and assigns properties', () => {
        const d = new ImageData(
            'https://a/preview.avif',
            'https://a/banner.avif',
            'https://a/full.avif',
            'https://a/lossless.avif',
            undefined,
            'https://source.jpg',
            undefined,
            'id-123',
        );
        expect(d.previewUrl).toBe('https://a/preview.avif');
        expect(d.bannerUrl).toBe('https://a/banner.avif');
        expect(d.fullUrl).toBe('https://a/full.avif');
        expect(d.losslessUrl).toBe('https://a/lossless.avif');
        expect(d.sourceUrl).toBe('https://source.jpg');
        expect(d.errorMessage).toBeUndefined();
        expect(d.id).toBe('id-123');
    });

    it('toDbRow returns Insertable with null for undefined and includes id when set', () => {
        const d = new ImageData('p', 'b', 'f', 'l', undefined, 's', undefined, 'uuid-1');
        const row = d.toDbRow();
        expect(row.previewUrl).toBe('p');
        expect(row.bannerUrl).toBe('b');
        expect(row.fullUrl).toBe('f');
        expect(row.losslessUrl).toBe('l');
        expect(row.sourceUrl).toBe('s');
        expect(row.errorMessage).toBeNull();
        expect(row.updatedAt).toBeInstanceOf(Date);
        expect(row.deletedAt).toBeNull();
        expect(row.id).toBe('uuid-1');
    });

    it('toDbRow omits id when not set', () => {
        const d = new ImageData('p', 'b', 'f', 'l', undefined, 's');
        const row = d.toDbRow();
        expect(row).toHaveProperty('previewUrl', 'p');
        expect(Object.prototype.hasOwnProperty.call(row, 'id') ? (row as { id?: string }).id : undefined).toBeUndefined();
    });

    it('fromDbRow builds ImageData from JSONSelectable', () => {
        const row: s.ImageData.JSONSelectable = {
            id: 'id-1',
            previewUrl: 'https://p',
            bannerUrl: 'https://b',
            fullUrl: 'https://f',
            losslessUrl: 'https://l',
            linkPreviewUrl: null,
            sourceUrl: 'https://s',
            errorMessage: null,
            metadata: null,
            allowUpdates: true,
            createdAt: '2025-01-01T00:00:00.000Z' as db.TimestampString,
            updatedAt: '2025-01-01T00:00:00.000Z' as db.TimestampString,
            deletedAt: null,
        };
        const d = ImageData.fromDbRow(row);
        expect(d.id).toBe('id-1');
        expect(d.previewUrl).toBe('https://p');
        expect(d.bannerUrl).toBe('https://b');
        expect(d.fullUrl).toBe('https://f');
        expect(d.losslessUrl).toBe('https://l');
        expect(d.sourceUrl).toBe('https://s');
        expect(d.errorMessage).toBeUndefined();
    });

    it('fromDbRow uses undefined for null fields', () => {
        const row: s.ImageData.JSONSelectable = {
            id: 'id-2',
            previewUrl: null,
            bannerUrl: null,
            fullUrl: null,
            losslessUrl: null,
            linkPreviewUrl: null,
            sourceUrl: 'https://s',
            errorMessage: 'failed',
            metadata: null,
            allowUpdates: true,
            createdAt: '2025-01-01T00:00:00.000Z' as db.TimestampString,
            updatedAt: '2025-01-01T00:00:00.000Z' as db.TimestampString,
            deletedAt: null,
        };
        const d = ImageData.fromDbRow(row);
        expect(d.previewUrl).toBeUndefined();
        expect(d.bannerUrl).toBeUndefined();
        expect(d.fullUrl).toBeUndefined();
        expect(d.losslessUrl).toBeUndefined();
        expect(d.errorMessage).toBe('failed');
    });

    it('fromDbRow parses metadata when present (sizeKB and quality)', () => {
        const metadataJSON = {
            preview: { sizeKB: 1.5, dimensions: { width: 256, height: 128 }, orientation: 1, quality: 50 },
            linkPreview: null,
            banner: null,
            full: null,
            lossless: null,
            source: { sizeKB: 100, dimensions: { width: 1920, height: 1080 }, orientation: 1 },
        };
        const row: s.ImageData.JSONSelectable = {
            id: 'id-3',
            previewUrl: 'https://p',
            bannerUrl: null,
            fullUrl: null,
            losslessUrl: null,
            linkPreviewUrl: null,
            sourceUrl: 'https://s',
            errorMessage: null,
            metadata: metadataJSON,
            allowUpdates: true,
            createdAt: '2025-01-01T00:00:00.000Z' as db.TimestampString,
            updatedAt: '2025-01-01T00:00:00.000Z' as db.TimestampString,
            deletedAt: null,
        };
        const d = ImageData.fromDbRow(row);
        expect(d.metadata).toBeInstanceOf(Metadata);
        expect(d.metadata![ImageVersion.preview]).not.toBeNull();
        expect(d.metadata![ImageVersion.preview]!.sizeKB).toBe(1.5);
        expect(d.metadata![ImageVersion.preview]!.quality).toBe(50);
        expect(d.metadata!.source!.sizeKB).toBe(100);
        expect(d.metadata!.source!.orientation).toBe(Orientation.Normal);
    });
});
