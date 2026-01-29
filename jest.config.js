/* global module */
module.exports = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/test'],
    testMatch: ['**/*.test.ts'],
    transform: {
        '^.+\\.ts$': 'ts-jest',
    },
    moduleFileExtensions: ['ts', 'js', 'json'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.test.ts',
    ],
    transformIgnorePatterns: [
        "/node_modules/(?!(uuid)/)", // This regex tells Jest to ignore all node_modules *except* uuid
    ],
    moduleNameMapper: {
        "^uuid$": require.resolve('uuid'),
    },
    setupFilesAfterEnv: ['<rootDir>/test/setupTests.ts'],
};

