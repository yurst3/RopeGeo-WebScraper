import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import type { Pool, PoolConfig } from 'pg';
import { Pool as PoolClass } from 'pg';
import { Signer as SignerClass } from '@aws-sdk/rds-signer';
import getDatabaseConnection from '../../src/helpers/getDatabaseConnection';

// Mock pg module
const mockPoolInstance = {
    end: jest.fn(),
} as unknown as Pool;

jest.mock('pg', () => ({
    Pool: jest.fn<(config?: PoolConfig) => Pool>(),
}));

// Mock @aws-sdk/rds-signer
const mockGetAuthToken = jest.fn<() => Promise<string>>();
const mockSignerInstance = {
    getAuthToken: mockGetAuthToken,
};

jest.mock('@aws-sdk/rds-signer', () => ({
    Signer: jest.fn<(config: {
        hostname: string;
        port: number;
        username: string;
        region: string;
    }) => typeof mockSignerInstance>(),
}));

describe('getDatabaseConnection', () => {
    const originalEnv = process.env;
    const mockPool = PoolClass as jest.MockedClass<typeof PoolClass>;
    const mockSignerConstructor = SignerClass as jest.MockedClass<typeof SignerClass>;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockPool.mockImplementation(() => mockPoolInstance as any);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mockSignerConstructor.mockImplementation(() => mockSignerInstance as any);
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    it('creates a pool with password authentication when DEV_ENVIRONMENT is not set', async () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'testdb';
        process.env.DB_USER = 'testuser';
        process.env.DB_PASSWORD = 'testpass';

        await getDatabaseConnection();

        expect(mockPool).toHaveBeenCalledTimes(1);
        const poolConfig = mockPool.mock.calls[0]?.[0];
        expect(poolConfig).toBeDefined();
        expect(poolConfig).toMatchObject({
            host: 'localhost',
            port: 5432,
            database: 'testdb',
            user: 'testuser',
            password: 'testpass',
            ssl: undefined,
        });
    });

    it('creates a pool with password authentication when DEV_ENVIRONMENT is not dev or production', async () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'testdb';
        process.env.DB_USER = 'testuser';
        process.env.DB_PASSWORD = 'testpass';
        process.env.DEV_ENVIRONMENT = 'local';

        await getDatabaseConnection();

        expect(mockPool).toHaveBeenCalledTimes(1);
        const poolConfig = mockPool.mock.calls[0]?.[0];
        expect(poolConfig).toBeDefined();
        expect(poolConfig).toMatchObject({
            host: 'localhost',
            port: 5432,
            database: 'testdb',
            user: 'testuser',
            password: 'testpass',
            ssl: undefined,
        });
        expect(mockSignerConstructor).not.toHaveBeenCalled();
    });

    it('creates a pool with IAM authentication when DEV_ENVIRONMENT is "dev"', async () => {
        const mockToken = 'mock-iam-token-12345';
        mockGetAuthToken.mockResolvedValue(mockToken);

        process.env.DB_HOST = 'dev-db.xxxxx.us-east-1.rds.amazonaws.com';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'dev-db';
        process.env.DB_USER = 'admin';
        process.env.DEV_ENVIRONMENT = 'dev';
        process.env.AWS_REGION = 'us-east-1';

        await getDatabaseConnection();

        expect(mockSignerConstructor).toHaveBeenCalledTimes(1);
        expect(mockSignerConstructor).toHaveBeenCalledWith({
            hostname: 'dev-db.xxxxx.us-east-1.rds.amazonaws.com',
            port: 5432,
            username: 'admin',
            region: 'us-east-1',
        });
        expect(mockGetAuthToken).toHaveBeenCalledTimes(1);

        expect(mockPool).toHaveBeenCalledTimes(1);
        const poolConfig = mockPool.mock.calls[0]?.[0];
        expect(poolConfig).toBeDefined();
        expect(poolConfig).toMatchObject({
            host: 'dev-db.xxxxx.us-east-1.rds.amazonaws.com',
            port: 5432,
            database: 'dev-db',
            user: 'admin',
            password: mockToken,
            ssl: {
                rejectUnauthorized: true,
            },
        });
    });

    it('creates a pool with password authentication when DEV_ENVIRONMENT is "production" (RDS Proxy)', async () => {
        process.env.DB_HOST = 'production-db-proxy.xxxxx.us-east-1.rds.amazonaws.com';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'production-db';
        process.env.DB_USER = 'admin';
        process.env.DB_PASSWORD = 'testpass';
        process.env.DEV_ENVIRONMENT = 'production';

        await getDatabaseConnection();

        expect(mockSignerConstructor).not.toHaveBeenCalled();
        expect(mockGetAuthToken).not.toHaveBeenCalled();

        expect(mockPool).toHaveBeenCalledTimes(1);
        const poolConfig = mockPool.mock.calls[0]?.[0];
        expect(poolConfig).toBeDefined();
        expect(poolConfig).toMatchObject({
            host: 'production-db-proxy.xxxxx.us-east-1.rds.amazonaws.com',
            port: 5432,
            database: 'production-db',
            user: 'admin',
            password: 'testpass',
            ssl: {
                rejectUnauthorized: true,
            },
        });
    });

    it('uses AWS_REGION from environment variable', async () => {
        const mockToken = 'mock-iam-token';
        mockGetAuthToken.mockResolvedValue(mockToken);

        process.env.DB_HOST = 'test-db.xxxxx.us-west-2.rds.amazonaws.com';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test-db';
        process.env.DB_USER = 'admin';
        process.env.DEV_ENVIRONMENT = 'dev';
        process.env.AWS_REGION = 'us-west-2';

        await getDatabaseConnection();

        expect(mockSignerConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                region: 'us-west-2',
            })
        );
    });

    it('falls back to AWS_DEFAULT_REGION when AWS_REGION is not set', async () => {
        const mockToken = 'mock-iam-token';
        mockGetAuthToken.mockResolvedValue(mockToken);

        process.env.DB_HOST = 'test-db.xxxxx.eu-west-1.rds.amazonaws.com';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test-db';
        process.env.DB_USER = 'admin';
        process.env.DEV_ENVIRONMENT = 'dev';
        delete process.env.AWS_REGION;
        process.env.AWS_DEFAULT_REGION = 'eu-west-1';

        await getDatabaseConnection();

        expect(mockSignerConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                region: 'eu-west-1',
            })
        );
    });

    it('falls back to us-east-1 when neither AWS_REGION nor AWS_DEFAULT_REGION is set', async () => {
        const mockToken = 'mock-iam-token';
        mockGetAuthToken.mockResolvedValue(mockToken);

        process.env.DB_HOST = 'test-db.xxxxx.rds.amazonaws.com';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'test-db';
        process.env.DB_USER = 'admin';
        process.env.DEV_ENVIRONMENT = 'dev';
        delete process.env.AWS_REGION;
        delete process.env.AWS_DEFAULT_REGION;

        await getDatabaseConnection();

        expect(mockSignerConstructor).toHaveBeenCalledWith(
            expect.objectContaining({
                region: 'us-east-1',
            })
        );
    });

    it('uses default port 5432 when DB_PORT is not set', async () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_NAME = 'testdb';
        process.env.DB_USER = 'testuser';
        process.env.DB_PASSWORD = 'testpass';
        delete process.env.DB_PORT;

        await getDatabaseConnection();

        expect(mockPool).toHaveBeenCalledTimes(1);
        const poolConfig = mockPool.mock.calls[0]?.[0];
        expect(poolConfig).toBeDefined();
        if (poolConfig) {
            expect(poolConfig.port).toBe(5432);
        }
    });

    it('uses custom port when DB_PORT is set', async () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_PORT = '5433';
        process.env.DB_NAME = 'testdb';
        process.env.DB_USER = 'testuser';
        process.env.DB_PASSWORD = 'testpass';

        await getDatabaseConnection();

        expect(mockPool).toHaveBeenCalledTimes(1);
        const poolConfig = mockPool.mock.calls[0]?.[0];
        expect(poolConfig).toBeDefined();
        if (poolConfig) {
            expect(poolConfig.port).toBe(5433);
        }
    });

    it('throws an error when DB_HOST is missing', async () => {
        process.env.DB_NAME = 'testdb';
        process.env.DB_USER = 'testuser';
        process.env.DB_PASSWORD = 'testpass';
        delete process.env.DB_HOST;

        await expect(getDatabaseConnection()).rejects.toThrow(
            'Missing required database environment variables: DB_HOST, DB_NAME, DB_USER'
        );
    });

    it('throws an error when DB_NAME is missing', async () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_USER = 'testuser';
        process.env.DB_PASSWORD = 'testpass';
        delete process.env.DB_NAME;

        await expect(getDatabaseConnection()).rejects.toThrow(
            'Missing required database environment variables: DB_HOST, DB_NAME, DB_USER'
        );
    });

    it('throws an error when DB_USER is missing', async () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_NAME = 'testdb';
        process.env.DB_PASSWORD = 'testpass';
        delete process.env.DB_USER;

        await expect(getDatabaseConnection()).rejects.toThrow(
            'Missing required database environment variables: DB_HOST, DB_NAME, DB_USER'
        );
    });

    it('throws an error when DB_PASSWORD is missing and not using IAM authentication', async () => {
        process.env.DB_HOST = 'localhost';
        process.env.DB_NAME = 'testdb';
        process.env.DB_USER = 'testuser';
        delete process.env.DB_PASSWORD;
        delete process.env.DEV_ENVIRONMENT;

        await expect(getDatabaseConnection()).rejects.toThrow(
            'Missing required database environment variable: DB_PASSWORD'
        );
    });

    it('does not require DB_PASSWORD when using IAM authentication (dev environment)', async () => {
        const mockToken = 'mock-iam-token';
        mockGetAuthToken.mockResolvedValue(mockToken);

        process.env.DB_HOST = 'dev-db.xxxxx.us-east-1.rds.amazonaws.com';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'dev-db';
        process.env.DB_USER = 'admin';
        process.env.DEV_ENVIRONMENT = 'dev';
        process.env.AWS_REGION = 'us-east-1';
        delete process.env.DB_PASSWORD;

        await expect(getDatabaseConnection()).resolves.toBe(mockPoolInstance);
        expect(mockPool).toHaveBeenCalledTimes(1);
    });

    it('requires DB_PASSWORD when using password authentication (production environment with RDS Proxy)', async () => {
        process.env.DB_HOST = 'production-db-proxy.xxxxx.us-east-1.rds.amazonaws.com';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'production-db';
        process.env.DB_USER = 'admin';
        process.env.DEV_ENVIRONMENT = 'production';
        delete process.env.DB_PASSWORD;

        await expect(getDatabaseConnection()).rejects.toThrow(
            'Missing required database environment variable: DB_PASSWORD'
        );
    });

    it('handles errors from RDS Signer', async () => {
        const signerError = new Error('Failed to generate auth token');
        mockGetAuthToken.mockRejectedValue(signerError);

        process.env.DB_HOST = 'dev-db.xxxxx.us-east-1.rds.amazonaws.com';
        process.env.DB_PORT = '5432';
        process.env.DB_NAME = 'dev-db';
        process.env.DB_USER = 'admin';
        process.env.DEV_ENVIRONMENT = 'dev';
        process.env.AWS_REGION = 'us-east-1';

        await expect(getDatabaseConnection()).rejects.toThrow('Failed to generate auth token');
    });
});

