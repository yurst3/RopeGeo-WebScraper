import type { GetRopewikiPagePreviewRow } from '../api/getRoutePreview/database/getRopewikiPagePreview';
import { PageDataSource } from './pageRoute';

/** Technical difficulty: 1–4 */
export enum DifficultyTechnical {
    One = '1',
    Two = '2',
    Three = '3',
    Four = '4',
}

/** Water difficulty: A, B, C, or C1–C4 */
export enum DifficultyWater {
    A = 'A',
    B = 'B',
    C = 'C',
    C1 = 'C1',
    C2 = 'C2',
    C3 = 'C3',
    C4 = 'C4',
}

/** Time difficulty: I–VI (Roman numerals) */
export enum DifficultyTime {
    I = 'I',
    II = 'II',
    III = 'III',
    IV = 'IV',
    V = 'V',
    VI = 'VI',
}

/** Risk rating: G, PG, PG13, R, X, XX */
export enum DifficultyRisk {
    G = 'G',
    PG = 'PG',
    PG13 = 'PG13',
    R = 'R',
    X = 'X',
    XX = 'XX',
}

/**
 * Difficulty ratings for a page (e.g. Ropewiki technical, water, time, risk).
 * Each property is nullable; the object is always present on PagePreview.
 * Throws if a non-empty rating string is not one of the allowed enum values.
 */
export class Difficulty {
    technical: DifficultyTechnical | null;
    water: DifficultyWater | null;
    time: DifficultyTime | null;
    risk: DifficultyRisk | null;

    constructor(
        technicalRating: string | null | undefined,
        waterRating: string | null | undefined,
        timeRating: string | null | undefined,
        riskRating: string | null | undefined,
    ) {
        this.technical = Difficulty.parseDifficultyField(
            technicalRating,
            Object.values(DifficultyTechnical),
            'technical',
        );
        this.water = Difficulty.parseDifficultyField(
            waterRating,
            Object.values(DifficultyWater),
            'water',
        );
        this.time = Difficulty.parseDifficultyField(
            timeRating,
            Object.values(DifficultyTime),
            'time',
        );
        this.risk = Difficulty.parseDifficultyField(
            riskRating,
            Object.values(DifficultyRisk),
            'risk',
        );
    }

    private static parseDifficultyField<T extends string>(
        value: string | null | undefined,
        allowed: readonly T[],
        fieldName: string,
    ): T | null {
        if (value == null || value === '') return null;
        const trimmed = value.trim();
        if (!(allowed as readonly string[]).includes(trimmed)) {
            throw new Error(
                `Invalid difficulty ${fieldName}: "${value}" is not one of [${(allowed as readonly string[]).join(', ')}]`,
            );
        }
        return trimmed as T;
    }
}

/**
 * Preview of a page linked to a route (e.g. Ropewiki page).
 * Used by GET /route/{routeId}/preview.
 */
export class PagePreview {
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
    /** Difficulty ratings (technical, water, time, risk); always present, each field nullable */
    difficulty: Difficulty;
    /** Map data id for the page route, or null if none */
    mapData: string | null;
    /** External link to the page (e.g. Ropewiki page URL) */
    externalLink: string | null;

    constructor(
        id: string,
        source: PageDataSource,
        imageUrl: string | null,
        rating: number | null,
        ratingCount: number | null,
        title: string,
        regions: string[],
        difficulty: Difficulty,
        mapData: string | null,
        externalLink: string | null,
    ) {
        this.id = id;
        this.source = source;
        this.imageUrl = imageUrl;
        this.rating = rating;
        this.ratingCount = ratingCount;
        this.title = title;
        this.regions = regions;
        this.difficulty = difficulty;
        this.mapData = mapData;
        this.externalLink = externalLink;
    }

    /**
     * Builds a PagePreview from a getRopewikiPagePreview query row (Ropewiki source).
     * @param regions - Optional region lineage (root to leaf). When provided, used instead of [row.regionName].
     */
    static fromDbRow(
        row: GetRopewikiPagePreviewRow,
        mapData: string | null,
        regions?: string[],
    ): PagePreview {
        return new PagePreview(
            row.pageId,
            PageDataSource.Ropewiki,
            row.bannerFileUrl ?? null,
            row.quality != null ? Number(row.quality) : null,
            row.userVotes ?? null,
            row.title,
            regions ?? [row.regionName],
            new Difficulty(
                row.technicalRating,
                row.waterRating,
                row.timeRating,
                row.riskRating,
            ),
            mapData,
            row.url ?? null,
        );
    }
}
