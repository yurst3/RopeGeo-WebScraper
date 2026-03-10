import { describe, it, expect } from '@jest/globals';
import ImageData from '../../../src/image-data/types/imageData';
import type * as s from 'zapatos/schema';

describe('ImageData', () => {
    it('constructs with optional args and assigns properties', () => {
        const d = new ImageData(
            'https://a/preview.avif',
            'https://a/banner.avif',
            'https://a/full.avif',
            'https://source.jpg',
            undefined,
            'id-123',
        );
        expect(d.previewUrl).toBe('https://a/preview.avif');
        expect(d.bannerUrl).toBe('https://a/banner.avif');
        expect(d.fullUrl).toBe('https://a/full.avif');
        expect(d.sourceUrl).toBe('https://source.jpg');
        expect(d.errorMessage).toBeUndefined();
        expect(d.id).toBe('id-123');
    });

    it('toDbRow returns Insertable with null for undefined and includes id when set', () => {
        const d = new ImageData('p', 'b', 'f', 's', undefined, 'uuid-1');
        const row = d.toDbRow();
        expect(row.previewUrl).toBe('p');
        expect(row.bannerUrl).toBe('b');
        expect(row.fullUrl).toBe('f');
        expect(row.sourceUrl).toBe('s');
        expect(row.errorMessage).toBeNull();
        expect(row.updatedAt).toBeInstanceOf(Date);
        expect(row.deletedAt).toBeNull();
        expect(row.id).toBe('uuid-1');
    });

    it('toDbRow omits id when not set', () => {
        const d = new ImageData('p', 'b', 'f', 's');
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
            sourceUrl: 'https://s',
            errorMessage: null,
            allowUpdates: true,
            updatedAt: '2025-01-01T00:00:00.000Z' as s.ImageData.TimestampString,
            deletedAt: null,
        };
        const d = ImageData.fromDbRow(row);
        expect(d.id).toBe('id-1');
        expect(d.previewUrl).toBe('https://p');
        expect(d.bannerUrl).toBe('https://b');
        expect(d.fullUrl).toBe('https://f');
        expect(d.sourceUrl).toBe('https://s');
        expect(d.errorMessage).toBeUndefined();
    });

    it('fromDbRow uses undefined for null fields', () => {
        const row: s.ImageData.JSONSelectable = {
            id: 'id-2',
            previewUrl: null,
            bannerUrl: null,
            fullUrl: null,
            sourceUrl: 'https://s',
            errorMessage: 'failed',
            allowUpdates: true,
            updatedAt: '2025-01-01T00:00:00.000Z' as s.ImageData.TimestampString,
            deletedAt: null,
        };
        const d = ImageData.fromDbRow(row);
        expect(d.previewUrl).toBeUndefined();
        expect(d.bannerUrl).toBeUndefined();
        expect(d.fullUrl).toBeUndefined();
        expect(d.errorMessage).toBe('failed');
    });
});
