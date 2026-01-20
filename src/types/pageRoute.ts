import type * as s from 'zapatos/schema';

export class PageRoute {
    route: string;
    page: string;
    mapData: string | undefined;

    constructor(
        route: string,
        page: string,
        mapData?: string,
    ) {
        this.route = route;
        this.page = page;
        this.mapData = mapData;
    }
};

export class RopewikiRoute extends PageRoute {
    toDbRow(): s.RopewikiRoute.Insertable {
        const now = new Date();
        return {
            route: this.route,
            ropewikiPage: this.page,
            mapData: this.mapData ?? null,
            updatedAt: now,
            deletedAt: null,
        };
    }

    static fromDbRow(row: s.RopewikiRoute.JSONSelectable): RopewikiRoute {
        return new RopewikiRoute(
            row.route,
            row.ropewikiPage,
            row.mapData ?? undefined,
        );
    }
}

export default RopewikiRoute;
