import type * as s from 'zapatos/schema';
import RopewikiPage from '../ropewiki/types/page';

export enum RouteType {
    Cave = 'Cave',
    Canyon = 'Canyon',
    POI = 'POI',
    Unknown = 'Unknown',
}

export class Route {
    id: string;
    name: string;
    type: RouteType;
    coordinates: unknown;

    constructor(id: string, name: string, type: RouteType, coordinates: unknown) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.coordinates = coordinates;
    }

    static fromDbRow(row: s.Route.JSONSelectable): Route {
        return new Route(
            row.id,
            row.name,
            row.type as RouteType,
            row.coordinates
        );
    }

    static fromRopewikiPage(page: RopewikiPage): Route {
        // Determine type based on rating
        let type = RouteType.Canyon; // default
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

        // Create an instance without calling the constructor
        const instance = Object.create(Route.prototype) as Route;

        // Set properties directly
        instance.name = page.name;
        instance.type = type;
        instance.coordinates = page.coordinates;

        return instance;
    }

    toDbRow(): s.Route.Insertable {
        const row: s.Route.Insertable = {
            name: this.name,
            type: this.type,
            coordinates: this.coordinates as s.Route.Insertable['coordinates'],
        };
        
        // Only include id if it's not empty (will use default gen_random_uuid() if omitted)
        if (this.id) {
            row.id = this.id;
        }
        
        return row;
    }
}
