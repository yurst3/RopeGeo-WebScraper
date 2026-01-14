import * as db from 'zapatos/db';
import RopewikiPageInfo from '../types/ropewiki';
import { Route } from '../../types/route';
import zip from 'lodash/zip';

const insertRoutesForPages = async (
    conn: db.Queryable,
    pages: RopewikiPageInfo[],
): Promise<string[][]> => {
    if (pages.length === 0) {
        return [];
    }

    if (pages.some(page => !page.id)) throw new Error('All pages must have an id');

    const routes = pages.map(page => Route.fromRopewikiPage(page));

    const results = await db.insert('Route', routes.map(route => route.toDbRow())).run(conn);

    return zip(results.map(row => row.id), pages.map(page => page.id)) as string[][];
};

export default insertRoutesForPages;
