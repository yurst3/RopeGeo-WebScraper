import type { Queryable } from 'zapatos/db';
import { PageDataSource } from 'ropegeo-common/models';
import type { PageRelevanceInput } from '../types/relevanceTypes';
import { loadRopewikiPageRelevanceInput } from './loadRopewikiPageRelevanceInput';

export type LoadRelevanceInputHook = (
    conn: Queryable,
    pageId: string,
    pageSource: PageDataSource,
) => Promise<PageRelevanceInput>;

const relevanceInputHooks: Partial<Record<PageDataSource, LoadRelevanceInputHook>> = {
    [PageDataSource.Ropewiki]: (conn, pageId) => loadRopewikiPageRelevanceInput(conn, pageId),
};

export function registerRelevanceInputHook(
    pageSource: PageDataSource,
    hook: LoadRelevanceInputHook,
): void {
    relevanceInputHooks[pageSource] = hook;
}

export async function loadRelevanceInput(
    conn: Queryable,
    pageId: string,
    pageSource: PageDataSource,
): Promise<PageRelevanceInput> {
    const hook = relevanceInputHooks[pageSource];
    if (hook == null) {
        throw new Error(`No relevance input hook registered for pageSource: ${pageSource}`);
    }
    return hook(conn, pageId, pageSource);
}
