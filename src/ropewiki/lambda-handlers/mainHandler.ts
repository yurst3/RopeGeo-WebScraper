import { main } from '../main';
import { lambdaProcessPagesChunk } from '../hook-functions/processPagesChunk';
import { lambdaProcessRopewikiRoutes } from '../hook-functions/processRopewikiRoutes';
import { isMainEvent } from '../types/mainEvent';

export const mainHandler = async (event: unknown) => {
    if (!isMainEvent(event)) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'Invalid event: expected MainEvent with processPages and processRoutes boolean properties',
            }),
        };
    }

    try {
        // Use the lambda hook functions which will send SQS messages instead of invoking the processors directly
        const elapsedTimeSeconds = await main(event, lambdaProcessPagesChunk, lambdaProcessRopewikiRoutes);
        
        // Format elapsed time
        const totalTimeHours = Math.floor(elapsedTimeSeconds / 3600);
        const totalTimeMinutes = Math.floor((elapsedTimeSeconds % 3600) / 60);
        const totalTimeSeconds = elapsedTimeSeconds % 60;
        const formattedTime = `${totalTimeHours}h ${totalTimeMinutes}m ${totalTimeSeconds}s`;
        
        console.log(`\nTotal time: ${formattedTime}`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'Ropewiki scraper completed successfully',
                totalTime: formattedTime,
            }),
        };
    } catch (error) {
        console.error('Error in Ropewiki scraper:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: 'Ropewiki scraper failed',
                error: error instanceof Error ? error.message : String(error),
            }),
        };
    }
};
