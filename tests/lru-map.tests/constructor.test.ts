import { describe, it, expect } from 'bun:test';
import { LruMap } from '../../src/lru-map';

const CAPACITY_VERIFICATION_COUNT = 50;

describe('LruMap constructor', () => {
	it.each([
		[0, RangeError],
		[-1, RangeError],
		[-100, RangeError],
		[NaN, RangeError],
		[Infinity, RangeError],
		[1.5, RangeError],
	])('{new LruMap} maxSize %s → throws %s', (maxSize, expectedError) => {
		// Arrange: maxSize is already defined in the table

		// Act & Assert
		expect(() => new LruMap(maxSize)).toThrow(expectedError);
	});

	it.each([1, 100])('{new LruMap} maxSize %d → does not throw', (maxSize) => {
		// Arrange

		// Act & Assert
		expect(() => new LruMap(maxSize)).not.toThrow();
	});

	it('{new LruMap} no arguments → defaults to maxSize of 100', () => {
		// Arrange
		const cache = new LruMap();

		// Assert
		expect(cache.size).toBe(0);
	});

	it('{new LruMap} default capacity → stores and retrieves entries up to limit', () => {
		// Arrange
		const cache = new LruMap();

		// Act
		for (let i = 0; i < CAPACITY_VERIFICATION_COUNT; i++) {
			cache.set(`key${i}`, i);
		}

		// Assert
		expect(cache.size).toBe(CAPACITY_VERIFICATION_COUNT);
		for (let i = 0; i < CAPACITY_VERIFICATION_COUNT; i++) {
			expect(cache.get(`key${i}`)).toBe(i);
		}
	});
});
