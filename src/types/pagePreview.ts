import type { PageDataSource } from './pageRoute';

/**
 * Preview of a page linked to a route (e.g. Ropewiki page).
 * Used by GET /route/{routeId}/preview.
 */
export interface PagePreview {
    /** Page identifier (e.g. RopewikiPage id) */
    id: string;
    /** Source of the page (e.g. ropewiki) */
    source: PageDataSource;
    /** Banner image URL (e.g. first non–beta-section image for Ropewiki) */
    imageUrl: string | null;
    /** Numeric rating (e.g. quality for Ropewiki) */
    rating: number | null;
    /** Number of votes (e.g. userVotes for Ropewiki) */
    ratingCount: number | null;
    /** Display title */
    title: string;
    /** Region names (not ids) */
    regions: string[];
    /** Difficulty string (e.g. rating text for Ropewiki) */
    difficulty: string | null;
    /** Map data id for the page route, or null if none */
    mapData: string | null;
}
