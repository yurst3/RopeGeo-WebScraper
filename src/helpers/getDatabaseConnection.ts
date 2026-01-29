import { Pool, PoolConfig } from 'pg';
import { Signer } from '@aws-sdk/rds-signer';

/**
 * Creates and returns a PostgreSQL connection pool.
 * - For "dev" environment: Uses AWS RDS IAM authentication (direct connection)
 * - For "production" environment: Uses password-based authentication (RDS Proxy handles auth via Secrets Manager)
 * - For local development: Uses password-based authentication
 */
export default async function getDatabaseConnection(): Promise<Pool> {
    const host = process.env.DB_HOST;
    const port = process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432;
    const database = process.env.DB_NAME;
    const user = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const devEnvironment = process.env.DEV_ENVIRONMENT;

    if (!host || !database || !user) {
        throw new Error('Missing required database environment variables: DB_HOST, DB_NAME, DB_USER');
    }

    const poolConfig: PoolConfig = {
        host,
        port,
        database,
        user,
        ssl: devEnvironment === 'dev' || devEnvironment === 'production' ? {
            rejectUnauthorized: true,
        } : undefined,
    };

    // Use AWS RDS IAM authentication for dev environment (direct connection)
    if (devEnvironment === 'dev') {
        // Get AWS region from hostname or environment variable
        // RDS hostnames typically include the region, e.g., dev-db.xxxxx.us-east-1.rds.amazonaws.com
        const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
        
        const signer = new Signer({
            hostname: host,
            port,
            username: user,
            region,
        });

        // Generate IAM authentication token
        const authToken = await signer.getAuthToken();
        poolConfig.password = authToken;
    } else {
        // Use password-based authentication for production (RDS Proxy) and local development
        if (!password) {
            throw new Error('Missing required database environment variable: DB_PASSWORD');
        }
        poolConfig.password = password;
    }

    return new Pool(poolConfig);
}

