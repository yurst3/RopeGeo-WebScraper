// Must run before loadRelevanceConfig imports the .txt system prompt.
import '../registerTxtRequire.js';
import getDatabaseConnection, { resetDatabaseConnectionPool } from '../../src/helpers/getDatabaseConnection';
import { findPageBySimilarName } from './findPageBySimilarName';
import { formatPageRelevanceUserPrompt } from '../../src/map-data/util/formatPageRelevancePayload';
import { loadModelConfigFromEnv, loadSystemPrompt } from '../../src/map-data/util/loadRelevanceConfig';
import { addUsage } from '../../src/map-data/util/addUsage';
import { loadRopewikiPageRelevanceInput } from '../../src/map-data/hook-functions/loadRopewikiPageRelevanceInput';
import { runLegendContextModel } from '../../src/map-data/http/runLegendContextModel';
import type {
    LegendItemContextResult,
    LegendItemInput,
    ModelConfig,
    PageRelevanceInput,
    TokenUsage,
} from '../../src/map-data/types/relevanceTypes';
import {
    formatLegendContextResultsForLog,
    validateLegendContext,
} from '../../src/map-data/util/validateLegendContextResponse';

const LEGEND_ITEM_BATCH_SIZE = 5;

type CliArgs = {
    name: string;
    promptPath?: string;
};

function printUsage(): void {
    console.log(`Usage: ts-node --files scripts/mapDataRelevance/testRelevance.ts <page name> [options]

Options:
  --prompt <path>     Path to system prompt .txt file

Environment:
  AI_GATEWAY_API_KEY                              Vercel AI Gateway API key
  MAP_DATA_RELEVANCE_GATEWAY_MODEL                e.g. deepseek/deepseek-v4-flash
  MAP_DATA_RELEVANCE_INPUT_PRICE_PER_MILLION      e.g. 0.14
  MAP_DATA_RELEVANCE_OUTPUT_PRICE_PER_MILLION     e.g. 0.28
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD Local database connection

Example:
  AI_GATEWAY_API_KEY=... \\
  MAP_DATA_RELEVANCE_GATEWAY_MODEL=deepseek/deepseek-v4-flash \\
  MAP_DATA_RELEVANCE_INPUT_PRICE_PER_MILLION=0.14 \\
  MAP_DATA_RELEVANCE_OUTPUT_PRICE_PER_MILLION=0.28 \\
  DB_HOST=127.0.0.1 DB_PORT=8081 DB_NAME=local DB_USER=localUser DB_PASSWORD=localPass \\
    npx ts-node --files scripts/mapDataRelevance/testRelevance.ts "The Subway"

Or: npm run test:map-data-relevance -- "The Subway"`);
}

function parseCliArgs(argv: string[]): CliArgs {
    const args = [...argv];
    let promptPath: string | undefined;
    const nameParts: string[] = [];

    for (let i = 0; i < args.length; i += 1) {
        const arg = args[i]!;
        if (arg === '--prompt') {
            promptPath = args[i + 1];
            if (promptPath == null) throw new Error('--prompt requires a path');
            i += 1;
            continue;
        }
        if (arg === '--help' || arg === '-h') {
            printUsage();
            process.exit(0);
        }
        nameParts.push(arg);
    }

    const name = nameParts.join(' ').trim();
    if (name.length === 0) {
        printUsage();
        throw new Error('Page name is required');
    }

    const result: CliArgs = { name };
    if (promptPath != null) result.promptPath = promptPath;
    return result;
}

type LegendItemRunOutcome = LegendItemContextResult & {
    usage: TokenUsage;
    estimatedCostUsd: number;
    durationMs: number;
};

async function runLegendItemBatch(
    legendItems: LegendItemInput[],
    input: PageRelevanceInput,
    modelConfig: ModelConfig,
    systemPrompt: string,
): Promise<LegendItemRunOutcome[]> {
    return Promise.all(
        legendItems.map(async (legendItem) => {
            const userPrompt = formatPageRelevanceUserPrompt(input, legendItem);
            let result;
            try {
                result = await runLegendContextModel(modelConfig, systemPrompt, userPrompt);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                console.error(
                    `Error from runLegendContextModel for legend item "${legendItem.name}" (${legendItem.id}): ${errorMessage}`,
                );
                console.error('userPrompt that caused the error:\n' + userPrompt);
                throw error;
            }
            const validatedContext = validateLegendContext(result.response, input);
            return {
                legendItem,
                context: validatedContext,
                usage: result.usage,
                estimatedCostUsd: result.estimatedCostUsd,
                durationMs: result.durationMs,
            };
        }),
    );
}

async function main(): Promise<void> {
    const cli = parseCliArgs(process.argv.slice(2));
    const modelConfig = loadModelConfigFromEnv();
    const systemPrompt = loadSystemPrompt(cli.promptPath);

    const pool = await getDatabaseConnection();
    const client = await pool.connect();

    try {
        console.log(`Searching for page most similar to: "${cli.name}"`);
        const match = await findPageBySimilarName(client, cli.name);
        if (match == null) {
            throw new Error('No RopewikiPage rows found in the database');
        }

        console.log(
            `Matched page: "${match.name}" (id: ${match.id}, similarity: ${match.similarityScore.toFixed(4)})`,
        );

        const input = await loadRopewikiPageRelevanceInput(client, match.id);

        console.log(`\nModel: ${modelConfig.gatewayModel}`);
        console.log(`MapData: ${input.mapDataId ?? '(none)'}`);
        console.log(`Legend items: ${input.legendItems.length}`);
        console.log(`Beta sections: ${input.betaSections.length}`);
        console.log(`Images with captions: ${input.images.filter((i) => i.caption?.trim()).length}`);

        if (input.legendItems.length === 0) {
            if (input.mapDataId == null) {
                throw new Error(
                    `No MapData found for page "${match.name}". Process map data for this page before running relevance tests.`,
                );
            }
            throw new Error(
                `No legend items found for page "${match.name}" (mapData: ${input.mapDataId}). Re-process map data to populate legend tables.`,
            );
        }

        const results: LegendItemContextResult[] = [];
        let totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
        let totalCostUsd = 0;

        console.log(
            `\nCalling model for each legend item (batch size ${LEGEND_ITEM_BATCH_SIZE})...\n`,
        );

        const startedAt = Date.now();

        for (let i = 0; i < input.legendItems.length; i += LEGEND_ITEM_BATCH_SIZE) {
            const batch = input.legendItems.slice(i, i + LEGEND_ITEM_BATCH_SIZE);
            const batchNumber = Math.floor(i / LEGEND_ITEM_BATCH_SIZE) + 1;
            console.log(
                `--- Batch ${batchNumber}: ${batch.map((item) => `${item.name} (${item.featureType})`).join(', ')} ---`,
            );

            const batchOutcomes = await runLegendItemBatch(batch, input, modelConfig, systemPrompt);

            for (const outcome of batchOutcomes) {
                results.push({ legendItem: outcome.legendItem, context: outcome.context });
                totalUsage = addUsage(totalUsage, outcome.usage);
                totalCostUsd += outcome.estimatedCostUsd;
                console.log(
                    `  ${outcome.legendItem.name}: ${outcome.durationMs} ms, ${outcome.usage.totalTokens} tokens, $${outcome.estimatedCostUsd.toFixed(6)}`,
                );
            }
        }

        const totalDurationMs = Date.now() - startedAt;

        console.log('\n--- Response ---');
        console.log(formatLegendContextResultsForLog(results));
        console.log('\n--- Metrics ---');
        console.log(`Duration: ${totalDurationMs} ms`);
        console.log(`Input tokens: ${totalUsage.inputTokens}`);
        console.log(`Output tokens: ${totalUsage.outputTokens}`);
        console.log(`Total tokens: ${totalUsage.totalTokens}`);
        console.log(`Estimated cost: $${totalCostUsd.toFixed(6)} USD`);
    } finally {
        client.release();
        await resetDatabaseConnectionPool();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error('Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    });
}
