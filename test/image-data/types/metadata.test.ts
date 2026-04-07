import { describe, it, expect } from '@jest/globals';
import { ImageVersion } from 'ropegeo-common/models';
import { Metadata, Orientation } from '../../../src/image-data/types/metadata';

describe('Metadata', () => {
    describe('toJSON', () => {
        it('returns null for all variants when empty', () => {
            const m = new Metadata();
            const json = m.toJSON();
            expect(json.preview).toBeNull();
            expect(json.linkPreview).toBeNull();
            expect(json.banner).toBeNull();
            expect(json.full).toBeNull();
            expect(json.lossless).toBeNull();
            expect(json.source).toBeNull();
        });

        it('serializes variant with sizeKB, dimensions, orientation, and optional quality', () => {
            const m = new Metadata(
                {
                    [ImageVersion.preview]: {
                        sizeKB: 2.5,
                        dimensions: { width: 256, height: 256 },
                        orientation: Orientation.Normal,
                        quality: 50,
                        mimeType: 'image/avif',
                    },
                },
                null,
            );
            const json = m.toJSON();
            expect(json.preview).toEqual({
                sizeKB: 2.5,
                dimensions: { width: 256, height: 256 },
                orientation: 1,
                quality: 50,
                mimeType: 'image/avif',
            });
            expect(json.banner).toBeNull();
        });

        it('omits quality when not set', () => {
            const m = new Metadata(
                {
                    [ImageVersion.preview]: {
                        sizeKB: 10,
                        dimensions: { width: 100, height: 100 },
                        orientation: Orientation.Normal,
                    },
                },
                null,
            );
            const json = m.toJSON();
            expect(json.preview).not.toHaveProperty('quality');
        });
    });

    describe('fromJSON', () => {
        it('returns empty Metadata for null', () => {
            const m = Metadata.fromJSON(null);
            expect(m[ImageVersion.preview] ?? null).toBeNull();
            expect(m.source).toBeNull();
        });

        it('returns empty Metadata for undefined', () => {
            const m = Metadata.fromJSON(undefined);
            expect(m[ImageVersion.preview] ?? null).toBeNull();
        });

        it('returns empty Metadata for non-object', () => {
            const m = Metadata.fromJSON('string');
            expect(m[ImageVersion.preview] ?? null).toBeNull();
        });

        it('throws on unknown keys', () => {
            expect(() => Metadata.fromJSON({ notAVersion: {} })).toThrow(/unknown key/);
        });

        it('parses valid object with preview and source', () => {
            const obj = {
                preview: { sizeKB: 1.2, dimensions: { width: 256, height: 128 }, orientation: 1, quality: 50 },
                linkPreview: null,
                banner: null,
                full: null,
                lossless: null,
                source: { sizeKB: 500, dimensions: { width: 1920, height: 1080 }, orientation: 6 },
            };
            const m = Metadata.fromJSON(obj);
            expect(m[ImageVersion.preview]).not.toBeNull();
            expect(m[ImageVersion.preview]!.sizeKB).toBe(1.2);
            expect(m.source).not.toBeNull();
            expect(m.source!.sizeKB).toBe(500);
        });

        it('accepts legacy size and maps to sizeKB', () => {
            const obj = {
                preview: { size: 3.5, dimensions: { width: 10, height: 10 }, orientation: 1 },
                linkPreview: null,
                banner: null,
                full: null,
                lossless: null,
                source: null,
            };
            const m = Metadata.fromJSON(obj);
            expect(m[ImageVersion.preview]!.sizeKB).toBe(3.5);
        });

        it('round-trip: toJSON then fromJSON preserves sizes', () => {
            const original = new Metadata(
                {
                    [ImageVersion.preview]: {
                        sizeKB: 1,
                        dimensions: { width: 100, height: 200 },
                        orientation: Orientation.Rotated90CW,
                        quality: 75,
                    },
                    [ImageVersion.banner]: {
                        sizeKB: 5,
                        dimensions: { width: 512, height: 512 },
                        orientation: Orientation.Normal,
                        quality: 75,
                    },
                },
                { sizeKB: 100, dimensions: { width: 800, height: 600 }, orientation: Orientation.Normal },
            );
            const json = original.toJSON();
            const restored = Metadata.fromJSON(json);
            expect(restored[ImageVersion.preview]!.sizeKB).toBe(original[ImageVersion.preview]!.sizeKB);
            expect(restored[ImageVersion.banner]!.sizeKB).toBe(original[ImageVersion.banner]!.sizeKB);
            expect(restored.source!.sizeKB).toBe(original.source!.sizeKB);
        });
    });

    describe('fromPipelineResults', () => {
        it('builds Metadata with mimeType and quality for each variant', () => {
            const previewData = Buffer.alloc(2048);
            const bannerData = Buffer.alloc(5120);
            const fullData = Buffer.alloc(10240);
            const losslessData = Buffer.alloc(20480);
            const sourceMeta = {
                sizeKB: 50,
                dimensions: { width: 800, height: 600 },
                orientation: Orientation.Rotated90CW as Orientation,
            };

            const m = Metadata.fromPipelineResults({
                variants: {
                    [ImageVersion.preview]: {
                        data: previewData,
                        info: { width: 256, height: 192 },
                        quality: 50,
                    },
                    [ImageVersion.banner]: {
                        data: bannerData,
                        info: { width: 512, height: 384 },
                        quality: 75,
                    },
                    [ImageVersion.full]: {
                        data: fullData,
                        info: { width: 800, height: 600 },
                        quality: 75,
                    },
                    [ImageVersion.lossless]: {
                        data: losslessData,
                        info: { width: 800, height: 600 },
                    },
                },
                source: sourceMeta,
            });

            expect(m[ImageVersion.preview]!.sizeKB).toBe(2);
            expect(m[ImageVersion.preview]!.mimeType).toBe('image/avif');
            expect(m[ImageVersion.banner]!.quality).toBe(75);
            expect(m[ImageVersion.lossless]!.quality).toBeUndefined();
            expect(m.source).toEqual(sourceMeta);
        });
    });

    describe('setVersion and setSource', () => {
        it('setVersion overwrites a slot', () => {
            const m = new Metadata(
                {
                    [ImageVersion.preview]: {
                        sizeKB: 1,
                        dimensions: { width: 10, height: 10 },
                        orientation: Orientation.Normal,
                    },
                },
                null,
            );
            m.setVersion(ImageVersion.preview, {
                sizeKB: 99,
                dimensions: { width: 20, height: 20 },
                orientation: Orientation.Normal,
            });
            expect(m[ImageVersion.preview]!.sizeKB).toBe(99);
        });

        it('setSource replaces source', () => {
            const m = new Metadata(
                {},
                { sizeKB: 1, dimensions: { width: 1, height: 1 }, orientation: Orientation.Normal },
            );
            m.setSource({
                sizeKB: 2,
                dimensions: { width: 2, height: 2 },
                orientation: Orientation.Rotated90CW,
            });
            expect(m.source!.sizeKB).toBe(2);
        });

        it('constructs with source only when init is omitted', () => {
            const src = {
                sizeKB: 10,
                dimensions: { width: 640, height: 480 },
                orientation: Orientation.Normal,
            };
            const m = new Metadata(undefined, src);
            expect(m[ImageVersion.preview]).toBeUndefined();
            expect(m.source).toEqual(src);
        });
    });
});
