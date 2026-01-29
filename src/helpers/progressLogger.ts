class ProgressLogger {
    private title: string;
    private total: number;
    private chunkStart: number = 0;
    private chunkEnd: number = 0;
    private current: number = 0;
    private errors: number = 0;
    private successes: number = 0;
    private progressIntervals: number[] = [];
    private lastProgressTime: number | null = null;
    private readonly maxIntervalsForAverage: number = 10; // Keep last 10 intervals for running average

    constructor(title: string, total: number) {
        this.title = title;
        this.total = total;
        this.chunkEnd = total;
    }

    setChunk(start: number, end: number): void {
        this.chunkStart = start;
        this.chunkEnd = end;
        this.current = start;
        this.lastProgressTime = Date.now();
    }

    getResults(): { errors: number; successes: number; remaining: number } {
        return {
            errors: this.errors,
            successes: this.successes,
            remaining: this.total - this.current,
        };
    }

    logError(message: string): void {
        this.errors++;
        this.writeLog(message);
    }

    logProgress(message: string): void {
        this.successes++;
        this.writeLog(message);
    }

    private writeLog(message: string): void {
        const now = Date.now();
        
        // Calculate time interval since last progress
        if (this.lastProgressTime !== null) {
            const interval = now - this.lastProgressTime;
            this.progressIntervals.push(interval);
            
            // Keep only the last N intervals for running average
            if (this.progressIntervals.length > this.maxIntervalsForAverage) {
                this.progressIntervals.shift();
            }
        }
        
        this.current++;
        this.lastProgressTime = now;

        // Calculate running average time per item
        const averageInterval = this.progressIntervals.length > 0
            ? this.progressIntervals.reduce((sum, interval) => sum + interval, 0) / this.progressIntervals.length
            : 0;

        // Calculate remaining items
        const remainingInChunk = this.chunkEnd - this.current + 1;
        const remainingTotal = this.total - this.current + 1;

        // Calculate estimated time remaining
        const estimatedTimeRemainingMs = averageInterval > 0
            ? averageInterval * remainingTotal
            : 0;

        // Format estimated time
        const estimatedHours = Math.floor(estimatedTimeRemainingMs / (1000 * 60 * 60));
        const estimatedMinutes = Math.floor((estimatedTimeRemainingMs % (1000 * 60 * 60)) / (1000 * 60));
        const estimatedSeconds = Math.floor((estimatedTimeRemainingMs % (1000 * 60)) / 1000);

        let estimatedTimeStr = '';
        if (estimatedHours > 0) {
            estimatedTimeStr = `${estimatedHours}h ${estimatedMinutes}m ${estimatedSeconds}s`;
        } else if (estimatedMinutes > 0) {
            estimatedTimeStr = `${estimatedMinutes}m ${estimatedSeconds}s`;
        } else {
            estimatedTimeStr = `${estimatedSeconds}s`;
        }

        // Log progress
        console.log(
            `${this.title}: ${message} | ` +
            `Progress: ${this.current}/${this.total} | ` +
            `Remaining in chunk: ${remainingInChunk} | ` +
            (estimatedTimeStr ? `ETA: ${estimatedTimeStr}` : 'ETA: calculating...')
        );
    }
}

export default ProgressLogger;

