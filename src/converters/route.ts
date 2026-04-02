import type * as s from 'zapatos/schema';
import { Route, RouteType } from 'ropegeo-common/classes';
import RopewikiPage from '../ropewiki/types/page';

export function routeFromDbRow(row: s.Route.JSONSelectable): Route {
    return new Route(row.id, row.name, row.type as RouteType, row.coordinates);
}

export function routeToDbRow(route: Route): s.Route.Insertable {
    const row: s.Route.Insertable = {
        name: route.name,
        type: route.type,
        coordinates: route.coordinates as s.Route.Insertable['coordinates'],
    };
    if (route.id) {
        row.id = route.id;
    }
    return row;
}

export function routeFromRopewikiPage(page: RopewikiPage): Route {
    let type = RouteType.Canyon;
    if (!page.rating) {
        type = RouteType.Unknown;
    } else {
        const ratingLower = page.rating.toLowerCase();
        if (ratingLower.includes('cav')) {
            type = RouteType.Cave;
        } else if (ratingLower.includes('poi')) {
            type = RouteType.POI;
        }
    }
    return new Route('', page.name, type, page.coordinates);
}
