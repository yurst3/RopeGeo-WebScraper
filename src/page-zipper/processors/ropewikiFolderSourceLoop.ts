import { PageDataSource } from 'ropegeo-common/models';
import getRopewikiPageView from '../../api/getRopewikiPageView/database/getRopewikiPageView';
import { getRopewikiImageBundleRows } from '../database/getRopewikiImageBundleRows';
import { getRopewikiPageIdsNeedingFolder } from '../database/getRopewikiPageIdsNeedingFolder';
import { getRopewikiPageForFolderReadiness } from '../database/getRopewikiPageForFolderReadiness';
import { updateRopewikiFolderForPage } from '../database/updateRopewikiFolderForPage';
import { isRopewikiPageReadyForFolder } from '../readiness/isRopewikiPageReadyForFolder';
import type { FolderSourceLoop } from './processSourceFolders';

/** Ropewiki hooks for single-page (and legacy multi-page) download folder builds. */
export const ropewikiFolderSourceLoop: FolderSourceLoop = {
    pageDataSource: PageDataSource.Ropewiki,
    getPageIdsNeedingFolder: getRopewikiPageIdsNeedingFolder,
    getOnlinePageView: getRopewikiPageView,
    getPageForFolder: getRopewikiPageForFolderReadiness,
    getImageBundleRows: getRopewikiImageBundleRows,
    updateFolderForPage: updateRopewikiFolderForPage,
    isPageReadyForFolder: isRopewikiPageReadyForFolder,
};
