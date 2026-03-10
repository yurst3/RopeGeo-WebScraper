import { describe, it, expect } from '@jest/globals';
import { RopewikiImage } from '../../../src/ropewiki/types/image';
import { ImageDataEvent } from '../../../src/image-data/types/lambdaEvent';
import { PageDataSource } from 'ropegeo-common';
import type * as s from 'zapatos/schema';

describe('RopewikiImage', () => {
    describe('fromDbRow', () => {
        it('builds RopewikiImage from a zapatos row with id set', () => {
            const row = {
                id: '11111111-1111-1111-1111-111111111111',
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: 'Caption here',
                order: 1,
            } as s.RopewikiImage.JSONSelectable;

            const img = RopewikiImage.fromDbRow(row);

            expect(img).toBeInstanceOf(RopewikiImage);
            expect(img.id).toBe(row.id);
            expect(img.linkUrl).toBe(row.linkUrl);
            expect(img.fileUrl).toBe(row.fileUrl);
            expect(img.caption).toBe(row.caption);
            expect(img.order).toBe(row.order);
            expect(img.betaSectionTitle).toBeUndefined();
        });

        it('maps null caption to undefined', () => {
            const row = {
                id: '22222222-2222-2222-2222-222222222222',
                linkUrl: 'https://ropewiki.com/Image2',
                fileUrl: 'https://ropewiki.com/files/Image2.jpg',
                caption: null,
                order: 0,
            } as s.RopewikiImage.JSONSelectable;

            const img = RopewikiImage.fromDbRow(row);

            expect(img.caption).toBeUndefined();
            expect(img.order).toBe(0);
        });

        it('sets processedImage from row when present', () => {
            const imageDataId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
            const row = {
                id: '33333333-3333-3333-3333-333333333333',
                processedImage: imageDataId,
                linkUrl: 'https://ropewiki.com/Image3',
                fileUrl: 'https://ropewiki.com/files/Image3.jpg',
                caption: null,
                order: 1,
            } as s.RopewikiImage.JSONSelectable;

            const img = RopewikiImage.fromDbRow(row);

            expect(img.processedImage).toBe(imageDataId);
        });

        it('sets processedImage to null when row.processedImage is null', () => {
            const row = {
                id: '44444444-4444-4444-4444-444444444444',
                processedImage: null,
                linkUrl: 'https://ropewiki.com/Image4',
                fileUrl: 'https://ropewiki.com/files/Image4.jpg',
                caption: null,
                order: 1,
            } as s.RopewikiImage.JSONSelectable;

            const img = RopewikiImage.fromDbRow(row);

            expect(img.processedImage).toBeNull();
        });
    });

    describe('toImageDataEvent', () => {
        it('returns ImageDataEvent when id is set', () => {
            const img = RopewikiImage.fromDbRow({
                id: '11111111-1111-1111-1111-111111111111',
                linkUrl: 'https://ropewiki.com/Image1',
                fileUrl: 'https://ropewiki.com/files/Image1.jpg',
                caption: null,
                order: 1,
            } as s.RopewikiImage.JSONSelectable);

            const event = img.toImageDataEvent();

            expect(event).toBeInstanceOf(ImageDataEvent);
            expect(event.pageDataSource).toBe(PageDataSource.Ropewiki);
            expect(event.id).toBe(img.id);
            expect(event.source).toBe(img.fileUrl);
        });

        it('throws when id is undefined', () => {
            const img = new RopewikiImage(undefined, 'https://a.com/l', 'https://a.com/f', undefined, 1);

            expect(() => img.toImageDataEvent()).toThrow('RopewikiImage must have an id to create ImageDataEvent');
        });

        it('throws when id is empty string', () => {
            const img = new RopewikiImage(undefined, 'https://a.com/l', 'https://a.com/f', undefined, 1);
            img.id = '';

            expect(() => img.toImageDataEvent()).toThrow('RopewikiImage must have an id to create ImageDataEvent');
        });
    });
});
