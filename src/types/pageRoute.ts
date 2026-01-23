import type * as s from 'zapatos/schema';
import { Route } from './route';
import RopewikiPage from '../ropewiki/types/page';
import { MapDataEvent } from '../map-data/types/lambdaEvent';

export enum PageDataSource {
    Ropewiki = 'ropewiki',
}

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

    static fromMapDataEvent(event: MapDataEvent): PageRoute {
        switch (event.source) {
            case PageDataSource.Ropewiki:
                return new RopewikiRoute(event.routeId, event.pageId, event.mapDataId);
        }
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

    static fromTuple([route, page]: [Route, RopewikiPage]): RopewikiRoute {
        if (!route.id) {
            throw new Error('Route must have an id to create RopewikiRoute');
        }
        if (!page.id) {
            throw new Error('RopewikiPage must have an id to create RopewikiRoute');
        }
        return new RopewikiRoute(route.id, page.id);
    }

    toMapDataEvent(): MapDataEvent {
        return new MapDataEvent(
            PageDataSource.Ropewiki,
            this.route,
            this.page,
            this.mapData,
        );
    }
}

export default RopewikiRoute;
