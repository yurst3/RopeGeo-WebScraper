import { Pool, PoolConfig } from 'pg';
import { Signer } from '@aws-sdk/rds-signer';

/**
 * Creates and returns a PostgreSQL connection pool.
 * - Dev/production with direct connect (USE_DATABASE_PROXY not true): AWS RDS IAM authentication.
 * - USE_DATABASE_PROXY true or local environment: password-based authentication.
 */
export default async function getDatabaseConnection(): Promise<Pool> {
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

    const poolConfig: PoolConfig = {
        host,
        port,
        database,
        user,
        ssl: isAwsEnvironment ? {
            // Avoid "self-signed certificate in certificate chain" when connecting to RDS (or via proxy).
            rejectUnauthorized: false,
        } : undefined,
    };

    if (useIamAuth) {
        const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
        const signer = new Signer({
            hostname: host,
            port,
            username: user,
            region,
        });
        const authToken = await signer.getAuthToken();
        poolConfig.password = authToken;
    } else {
        if (!password) {
            throw new Error('Missing required database environment variable: DB_PASSWORD');
        }
        poolConfig.password = password;
    }

    return new Pool(poolConfig);
}

