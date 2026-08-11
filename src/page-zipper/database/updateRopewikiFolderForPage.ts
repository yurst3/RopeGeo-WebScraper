import * as db from 'zapatos/db';
import { buildFolderPublicUrl } from '../util/buildFolderPublicUrl';

export async function updateRopewikiFolderForPage(
    conn: db.Queryable,
    pageId: string,
): Promise<void> {
    const downloadFolder = buildFolderPublicUrl(pageId);
    await db
        .update(
            'RopewikiPage',
            {
                downloadFolder,
                downloadFolderBuiltAt: db.sql`now()`,
            },
            { id: pageId },
        )
        .run(conn);
}
