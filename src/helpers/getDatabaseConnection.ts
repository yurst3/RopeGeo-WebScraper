import { Pool, PoolConfig } from 'pg';
import { Signer } from '@aws-sdk/rds-signer';

const DEFAULT_POOL_MAX = 2;
/** Refresh the pool before RDS IAM auth tokens expire (15 min). */
const IAM_TOKEN_MAX_AGE_MS = 14 * 60 * 1000;
const IDLE_TIMEOUT_MS = 60_000;

type ConnectionSettings = {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string | undefined;
    isAwsEnvironment: boolean;
    useIamAuth: boolean;
};

type PoolCache = {
    pool: Pool;
    key: string;
    iamTokenFetchedAt?: number;
};

let cache: PoolCache | undefined;
let createPoolPromise: Promise<Pool> | undefined;

function resolvePoolMax(): number {
    const raw = process.env.DB_POOL_MAX;
    if (raw == null || raw === '') return DEFAULT_POOL_MAX;
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_POOL_MAX;
}

function readConnectionSettings(): ConnectionSettings {
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
    const database = process.env.DB_NAME;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const devEnvironment = process.env.DEV_ENVIRONMENT;
    const useDatabaseProxy = process.env.USE_DATABASE_PROXY === 'true';

    if (!host || !database || !user) {
        throw new Error('Missing required database environment variables: DB_HOST, DB_NAME, DB_USER');
    }

    const isAwsEnvironment = devEnvironment === 'dev' || devEnvironment === 'production';
    const useIamAuth = isAwsEnvironment && !useDatabaseProxy;

    return {
        host,
        port,
        database,
        user,
        password,
        isAwsEnvironment,
        useIamAuth,
    };
}

function buildCacheKey(settings: ConnectionSettings): string {
    const authMode = settings.useIamAuth ? 'iam' : 'password';
    return `${settings.host}:${settings.port}:${settings.database}:${settings.user}:${authMode}`;
}

function isPoolEnded(pool: Pool): boolean {
    const maybeEnding = pool as Pool & { ending?: boolean; ended?: boolean };
    return maybeEnding.ending === true || maybeEnding.ended === true;
}

function isCachedPoolUsable(key: string): boolean {
    if (!cache) return false;
    if (cache.key !== key) return false;
    if (isPoolEnded(cache.pool)) return false;
    if (cache.iamTokenFetchedAt != null) {
        const age = Date.now() - cache.iamTokenFetchedAt;
        if (age >= IAM_TOKEN_MAX_AGE_MS) return false;
    }
    return true;
}

async function fetchIamPassword(host: string, port: number, user: string): Promise<string> {
    const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
    const signer = new Signer({
        hostname: host,
        port,
        username: user,
        region,
    });
    return signer.getAuthToken();
}

async function createPool(): Promise<Pool> {
    const settings = readConnectionSettings();
    const {
        host,
        port,
        database,
        user,
        password,
        isAwsEnvironment,
        useIamAuth,
    } = settings;

    const poolConfig: PoolConfig = {
        host,
        port,
        database,
        user,
        max: resolvePoolMax(),
        idleTimeoutMillis: IDLE_TIMEOUT_MS,
        allowExitOnIdle: true,
        ssl: isAwsEnvironment ? {
            // Avoid "self-signed certificate in certificate chain" when connecting to RDS (or via proxy).
            rejectUnauthorized: false,
        } : undefined,
    };

    let iamTokenFetchedAt: number | undefined;
    if (useIamAuth) {
        poolConfig.password = await fetchIamPassword(host, port, user);
        iamTokenFetchedAt = Date.now();
    } else {
        if (!password) {
            throw new Error('Missing required database environment variable: DB_PASSWORD');
        }
        poolConfig.password = password;
    }

    const pool = new Pool(poolConfig);
    const nextCache: PoolCache = {
        pool,
        key: buildCacheKey(settings),
    };
    if (iamTokenFetchedAt != null) {
        nextCache.iamTokenFetchedAt = iamTokenFetchedAt;
    }
    cache = nextCache;
    return pool;
}

async function disposeCachedPool(): Promise<void> {
    if (!cache) return;
    const pool = cache.pool;
    cache = undefined;
    if (!isPoolEnded(pool)) {
        await pool.end();
    }
}

/**
 * Clears the module-level pool singleton. Use in one-shot scripts after work completes,
 * or in tests between cases.
 */
export async function resetDatabaseConnectionPool(): Promise<void> {
    createPoolPromise = undefined;
    await disposeCachedPool();
}

/**
 * Returns a shared PostgreSQL connection pool for the current Lambda container (or Node process).
 * - Dev/production with direct connect (USE_DATABASE_PROXY not true): AWS RDS IAM authentication.
 * - USE_DATABASE_PROXY true or local environment: password-based authentication.
 *
 * Release clients with `client.release()` after use. Do not call `pool.end()` in Lambda handlers.
 */
export default async function getDatabaseConnection(): Promise<Pool> {
    const key = buildCacheKey(readConnectionSettings());

    if (isCachedPoolUsable(key)) {
        return cache!.pool;
    }

    if (createPoolPromise) {
        return createPoolPromise;
    }

    if (cache) {
        await disposeCachedPool();
    }

    createPoolPromise = createPool().finally(() => {
        createPoolPromise = undefined;
    });

    return createPoolPromise;
}
