export type RappelCountResult = { min: number; max: number } | number | null;

/**
 * Parses rappelInfo (e.g. "5r", "4-6r", "5r+1j", "4-6r+2j") and optional DB rappelCount.
 * - "<min>-<max>r" → rappelCount = { min, max }
 * - "<n>r" only → rappelCount = n
 * - "+j" → jumps = 1; "+<n>j" → jumps = n
 * If rappelInfo yields no rappel count but dbRappelCount is set, rappelCount = dbRappelCount (number).
 */
function parseRappelInfo(
    rappelInfo: string | null,
    dbRappelCount: number | null,
): { rappelCount: RappelCountResult; jumps: number | null } {
    let rappelCount: RappelCountResult = null;
    let jumps: number | null = null;

    if (rappelInfo != null && rappelInfo !== '') {
        const s = rappelInfo.trim();
        const rangeMatch = s.match(/^(\d+)-(\d+)r/);
        const singleMatch = s.match(/^(\d+)r/);
        if (rangeMatch) {
            rappelCount = {
                min: parseInt(rangeMatch[1]!, 10),
                max: parseInt(rangeMatch[2]!, 10),
            };
        } else if (singleMatch) {
            rappelCount = parseInt(singleMatch[1]!, 10);
        }
        const jumpsMatch = s.match(/\+(\d*)j/);
        if (jumpsMatch) {
            jumps = jumpsMatch[1] === '' ? 1 : parseInt(jumpsMatch[1]!, 10);
        }
    }

    if (rappelCount == null && dbRappelCount != null) {
        rappelCount = dbRappelCount;
    }

    return { rappelCount, jumps };
}

export default parseRappelInfo;
