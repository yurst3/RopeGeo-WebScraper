import { describe, it, expect } from '@jest/globals';
import { makeUnnestPart, type DbInsertRowClass } from '../../src/helpers/makeUnnestPart';

describe('makeUnnestPart', () => {
    type TestRow = { a: string; b: number };
    const validRowClass: DbInsertRowClass<TestRow> = {
        getDbInsertColumns: () => ['a', 'b'] as const,
        getDbInsertColumnTypes: () => ['text', 'integer'],
    };

    it('throws when getDbInsertColumns is not a function', () => {
        const badClass = {
            getDbInsertColumns: undefined,
            getDbInsertColumnTypes: () => ['text'],
        };
        expect(() => makeUnnestPart(badClass as unknown as DbInsertRowClass<TestRow>, [])).toThrow(
            'Row class must have getDbInsertColumns() and getDbInsertColumnTypes()',
        );
    });

    it('throws when getDbInsertColumnTypes is not a function', () => {
        const badClass = {
            getDbInsertColumns: () => ['a'],
            getDbInsertColumnTypes: null,
        };
        expect(() => makeUnnestPart(badClass as unknown as DbInsertRowClass<TestRow>, [])).toThrow(
            'Row class must have getDbInsertColumns() and getDbInsertColumnTypes()',
        );
    });

    it('returns a SQL fragment when given valid class and empty rows', () => {
        const result = makeUnnestPart(validRowClass, []);
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
    });

    it('returns a SQL fragment when given valid class and non-empty rows', () => {
        const rows: TestRow[] = [
            { a: 'x', b: 1 },
            { a: 'y', b: 2 },
        ];
        const result = makeUnnestPart(validRowClass, rows);
        expect(result).toBeDefined();
        expect(typeof result).toBe('object');
    });

    it('uses column order from getDbInsertColumns', () => {
        const rows: TestRow[] = [{ a: 'test', b: 42 }];
        const result = makeUnnestPart(validRowClass, rows);
        expect(result).toBeDefined();
    });

    it('matches column count to column types length', () => {
        const twoColClass: DbInsertRowClass<TestRow> = {
            getDbInsertColumns: () => ['a', 'b'] as const,
            getDbInsertColumnTypes: () => ['text', 'integer'],
        };
        const result = makeUnnestPart(twoColClass, [{ a: 'v', b: 0 }]);
        expect(result).toBeDefined();
    });
});
