import { PermitStatus } from 'ropegeo-common/models';

/**
 * Maps a permits string from the DB to PermitStatus enum, or null if empty/unknown.
 */
function parsePermit(permits: string | null): PermitStatus | null {
    if (permits == null || permits === '') return null;
    const normalized = permits.trim();
    if (normalized === 'Yes') return PermitStatus.Yes;
    if (normalized === 'No') return PermitStatus.No;
    if (normalized === 'Restricted') return PermitStatus.Restricted;
    if (normalized === 'Closed') return PermitStatus.Closed;
    return null;
}

export default parsePermit;
