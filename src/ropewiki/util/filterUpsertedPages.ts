import RopewikiPage from '../types/page';

/**
 * Filters an array of RopewikiPage objects to only include pages that have coordinates.
 * 
 * @param pages - Array of RopewikiPage objects to filter
 * @returns Array of RopewikiPage objects that have coordinates
 */
const filterUpsertedPages = (pages: RopewikiPage[]): RopewikiPage[] => {
    return pages.filter(page => page.coordinates !== undefined);
};

export default filterUpsertedPages;
