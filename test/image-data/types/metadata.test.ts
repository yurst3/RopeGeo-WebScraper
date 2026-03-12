import { describe, it, expect } from '@jest/globals';
import { Metadata, Orientation } from '../../../src/image-data/types/metadata';

describe('Metadata', () => {
    describe('toJSON', () => {
        it('returns null for all variants when empty', () => {
            const m = new Metadata();
            const json = m.toJSON();
            expect(json.preview).toBeNull();
            expect(json.banner).toBeNull();
            expect(json.full).toBeNull();
            expect(json.lossless).toBeNull();
            expect(json.source).toBeNull();
        });

        it('serializes variant with sizeKB, dimensions, orientation, and optional quality', () => {
            const m = new Metadata(
                { sizeKB: 2.5, dimensions: { width: 256, height: 256 }, orientation: Orientation.Normal, quality: 50 },
                null,
                null,
                null,
                null,
            );
            const json = m.toJSON();
            expect(json.preview).toEqual({
                sizeKB: 2.5,
                dimensions: { width: 256, height: 256 },
                orientation: 1,
                quality: 50,
            });
            expect(json.banner).toBeNull();
        });

        it('omits quality when not set', () => {
            const m = new Metadata(
                { sizeKB: 10, dimensions: { width: 100, height: 100 }, orientation: Orientation.Normal },
                null,
                null,
                null,
                null,
            );
            const json = m.toJSON();
            expect(json.preview).not.toHaveProperty('quality');
            expect(json.preview).toEqual({
                sizeKB: 10,
                dimensions: { width: 100, height: 100 },
                orientation: 1,
            });
        });
    });

    describe('fromJSON', () => {
        it('returns empty Metadata for null', () => {
            const m = Metadata.fromJSON(null);
            expect(m.preview).toBeNull();
            expect(m.source).toBeNull();
        });

        it('returns empty Metadata for undefined', () => {
            const m = Metadata.fromJSON(undefined);
            expect(m.preview).toBeNull();
        });

        it('returns empty Metadata for non-object', () => {
            const m = Metadata.fromJSON('string');
            expect(m.preview).toBeNull();
        });

        it('parses valid object with preview and source', () => {
            const obj = {
                preview: { sizeKB: 1.2, dimensions: { width: 256, height: 128 }, orientation: 1, quality: 50 },
                banner: null,
                full: null,
                lossless: null,
                source: { sizeKB: 500, dimensions: { width: 1920, height: 1080 }, orientation: 6 },
            };
            const m = Metadata.fromJSON(obj);
            expect(m.preview).not.toBeNull();
            expect(m.preview!.sizeKB).toBe(1.2);
            expect(m.preview!.dimensions).toEqual({ width: 256, height: 128 });
            expect(m.preview!.orientation).toBe(Orientation.Normal);
            expect(m.preview!.quality).toBe(50);
            expect(m.source).not.toBeNull();
            expect(m.source!.sizeKB).toBe(500);
            expect(m.source!.orientation).toBe(6);
        });

        it('accepts legacy size and maps to sizeKB', () => {
            const obj = {
                preview: { size: 3.5, dimensions: { width: 10, height: 10 }, orientation: 1 },
                banner: null,
                full: null,
                lossless: null,
                source: null,
            };
            const m = Metadata.fromJSON(obj);
            expect(m.preview!.sizeKB).toBe(3.5);
        });

        it('round-trip: toJSON then fromJSON equals original', () => {
            const original = new Metadata(
                { sizeKB: 1, dimensions: { width: 100, height: 200 }, orientation: Orientation.Rotated90CW, quality: 75 },
                { sizeKB: 5, dimensions: { width: 512, height: 512 }, orientation: Orientation.Normal, quality: 75 },
                null,
                null,
                { sizeKB: 100, dimensions: { width: 800, height: 600 }, orientation: Orientation.Normal },
            );
            const json = original.toJSON();
            const restored = Metadata.fromJSON(json);
            expect(restored.preview).not.toBeNull();
            expect(restored.preview!.sizeKB).toBe(original.preview!.sizeKB);
            expect(restored.preview!.quality).toBe(original.preview!.quality);
            expect(restored.banner!.sizeKB).toBe(original.banner!.sizeKB);
            expect(restored.source!.sizeKB).toBe(original.source!.sizeKB);
        });
    });

    describe('fromResults', () => {
        it('builds Metadata with sizeKB, dimensions, orientation, and quality for each variant', () => {
            const previewData = Buffer.alloc(2048);
            const bannerData = Buffer.alloc(5120);
            const fullData = Buffer.alloc(10240);
            const losslessData = Buffer.alloc(20480);
            const sourceMeta = {
                sizeKB: 50,
                dimensions: { width: 800, height: 600 },
                orientation: Orientation.Rotated90CW as Orientation,
            };

            const m = Metadata.fromResults({
                preview: {
                    data: previewData,
                    info: { width: 256, height: 192 },
                    quality: 50,
                },
                banner: {
                    data: bannerData,
                    info: { width: 512, height: 384 },
                    quality: 75,
                },
                full: {
                    data: fullData,
                    info: { width: 800, height: 600 },
                    quality: 75,
                },
                lossless: {
                    data: losslessData,
                    info: { width: 800, height: 600 },
                },
                source: sourceMeta,
            });

            expect(m.preview).not.toBeNull();
            expect(m.preview!.sizeKB).toBe(2);
            expect(m.preview!.dimensions).toEqual({ width: 256, height: 192 });
            expect(m.preview!.orientation).toBe(Orientation.Normal);
            expect(m.preview!.quality).toBe(50);

            expect(m.banner!.sizeKB).toBe(5);
            expect(m.banner!.quality).toBe(75);

            expect(m.full!.sizeKB).toBe(10);
            expect(m.full!.quality).toBe(75);

            expect(m.lossless).not.toBeNull();
            expect(m.lossless!.sizeKB).toBe(20);
            expect(m.lossless!.quality).toBeUndefined();

            expect(m.source).toEqual(sourceMeta);
            expect(m.source!.orientation).toBe(Orientation.Rotated90CW);
        });
    });
});
