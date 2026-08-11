/**
 * Initial imageDataReady map for PageZipperJob after a page upsert.
 * Each upserted image id is ready when it will not be enqueued for processing
 * (already has usable processed image / not in toProcess).
 */
const buildImageDataReady = (
    upsertedImages: ReadonlyArray<{ id?: string | null }>,
    toProcess: ReadonlyArray<{ id?: string | null }>,
): Record<string, boolean> => {
    const toProcessIds = new Set(
        toProcess.map((img) => img.id).filter((id): id is string => id != null && id !== ''),
    );
    const imageDataReady: Record<string, boolean> = {};
    for (const img of upsertedImages) {
        if (img.id == null || img.id === '') {
            continue;
        }
        imageDataReady[img.id] = !toProcessIds.has(img.id);
    }
    return imageDataReady;
};

export default buildImageDataReady;
