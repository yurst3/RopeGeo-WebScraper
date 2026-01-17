import type * as s from 'zapatos/schema';

export class RopewikiRegion {
    id: string | undefined
    name: string
    parentRegion: string | undefined
    pageCount: number
    level: number
    overview: string | undefined
    bestMonths: string[]
    isMajorRegion: boolean
    isTopLevelRegion: boolean
    latestRevisionDate: Date
    url: string

    constructor (
        name: string,
        parentRegion: string | undefined,
        pageCount: number,
        level: number,
        overview: string | undefined,
        bestMonths: string[],
        isMajorRegion: boolean,
        isTopLevelRegion: boolean,
        latestRevisionDate: Date,
        url?: string,
        id?: string,
    ) {
        this.name = name;
        this.parentRegion = parentRegion;
        this.pageCount = pageCount;
        this.level = level;
        this.overview = overview;
        this.bestMonths = bestMonths;
        this.isMajorRegion = isMajorRegion;
        this.isTopLevelRegion = isTopLevelRegion;
        this.latestRevisionDate = latestRevisionDate;
        // Generate URL from name: replace spaces with underscores and append to ropewiki.com
        this.url = url ?? `https://ropewiki.com/${name.replace(/ /g, '_')}`;
        this.id = id;
    }

    static fromResponseBody(name: string, raw: unknown): RopewikiRegion {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { printouts } = raw as { printouts: any };

        // Parse latestRevisionDate
        const latestRevisionDateRaw = Array.isArray(printouts.latestRevisionDate) && printouts.latestRevisionDate.length > 0
            ? printouts.latestRevisionDate[0]
            : undefined;
        const latestRevisionDate = latestRevisionDateRaw && latestRevisionDateRaw.timestamp
            ? new Date(Number(latestRevisionDateRaw.timestamp) * 1000) // Convert Unix timestamp (seconds) to milliseconds
            : new Date(0); // Default to epoch if not found

        // Parse parentRegion - use fulltext from the region object
        const parentRegion = Array.isArray(printouts.parentRegion) && printouts.parentRegion.length > 0 && printouts.parentRegion[0]?.fulltext
            ? String(printouts.parentRegion[0].fulltext)
            : undefined;

        // Parse pageCount
        const pageCount = Array.isArray(printouts.pageCount) && printouts.pageCount.length > 0
            ? Number(printouts.pageCount[0])
            : 0;

        // Parse level
        const level = Array.isArray(printouts.level) && printouts.level.length > 0
            ? Number(printouts.level[0])
            : 0;

        // Parse overview
        const overview = Array.isArray(printouts.overview) && printouts.overview.length > 0
            ? String(printouts.overview[0])
            : undefined;

        // Parse bestMonths - array of strings
        const bestMonths = Array.isArray(printouts.bestMonths)
            ? printouts.bestMonths.map((m: unknown) => String(m))
            : [];

        // Parse isMajorRegion - if empty array, set to false, otherwise parse "f" or "t"
        const isMajorRegion = Array.isArray(printouts.isMajorRegion) && printouts.isMajorRegion.length > 0
            ? String(printouts.isMajorRegion[0]) === 't'
            : false;

        // Parse isTopLevelRegion - if empty array, set to false, otherwise parse "f" or "t"
        const isTopLevelRegion = Array.isArray(printouts.isTopLevelRegion) && printouts.isTopLevelRegion.length > 0
            ? String(printouts.isTopLevelRegion[0]) === 't'
            : false;

        return new RopewikiRegion(
            name,
            parentRegion,
            pageCount,
            level,
            overview,
            bestMonths,
            isMajorRegion,
            isTopLevelRegion,
            latestRevisionDate
        );
    }

    toDbRow(): s.RopewikiRegion.Insertable {
        const now = new Date();
        const row: s.RopewikiRegion.Insertable = {
            name: this.name,
            parentRegion: this.parentRegion ?? null,
            pageCount: this.pageCount,
            level: this.level,
            overview: this.overview ?? null,
            bestMonths: this.bestMonths && this.bestMonths.length > 0 ? JSON.stringify(this.bestMonths) : '[]',
            isMajorRegion: this.isMajorRegion,
            isTopLevelRegion: this.isTopLevelRegion,
            latestRevisionDate: this.latestRevisionDate,
            url: this.url,
            updatedAt: now,
            deletedAt: null,
        };
        
        // Only include id if it's set (non-empty), allowing the database default to generate it
        if (this.id) {
            row.id = this.id;
        }
        
        return row;
    }

    static fromDbRow(row: s.RopewikiRegion.JSONSelectable): RopewikiRegion {
        // Parse JSON fields back to their original format
        const bestMonths = row.bestMonths as string[] | null;

        // Create instance using constructor
        return new RopewikiRegion(
            row.name,
            row.parentRegion ?? undefined,
            row.pageCount,
            row.level,
            row.overview ?? undefined,
            bestMonths ?? [],
            row.isMajorRegion ?? false,
            row.isTopLevelRegion ?? false,
            new Date(row.latestRevisionDate),
            row.url,
            row.id
        );
    }

    // https://ropewiki.com/index.php?title=Special:Properties&limit=500&offset=0
    // "Has ..." is the property as described in the link above
    static getApiRequestPrintouts(): {[name: string]: string} {
        return {
            latestRevisionDate: "Max Modification date",
            parentRegion: "Located in region",
            pageCount: "Has location count",
            level: "Has region level",
            overview: "Has overview",
            bestMonths: "Has best month",
            isMajorRegion: "Is major region",
            isTopLevelRegion: "Is top level region",
        };
    }
}
