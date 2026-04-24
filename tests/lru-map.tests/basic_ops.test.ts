import { describe, it, expect } from 'bun:test';
import { LruMap } from '../../src/lru-map';

describe('LruMap basic operations', () => {
	it('{set/get} valid key → retrieves value', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);

		// Act
		cache.set('a', 1);
		const result = cache.get('a');

		// Assert
		expect(result).toBe(1);
	});

	it('{get} missing key → returns undefined', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);

		// Act
		const result = cache.get('missing');

		// Assert
		expect(result).toBeUndefined();
	});

	it('{set} existing key → overwrites value', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);
		cache.set('a', 1);

		// Act
		cache.set('a', 2);

		// Assert
		expect(cache.get('a')).toBe(2);
		expect(cache.size).toBe(1);
	});

	it('{has} existing key → returns true', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);
		cache.set('a', 1);

		// Act
		const result = cache.has('a');

		// Assert
		expect(result).toBe(true);
	});

	it('{has} missing key → returns false', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);

		// Act
		const result = cache.has('missing');

		// Assert
		expect(result).toBe(false);
	});

	it('{peek} existing key → returns value', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);
		cache.set('a', 42);

		// Act
		const result = cache.peek('a');

		// Assert
		expect(result).toBe(42);
	});

	it('{peek} missing key → returns undefined', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);

		// Act
		const result = cache.peek('missing');

		// Assert
		expect(result).toBeUndefined();
	});

	it('{size} track entries → returns correct count', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);

		// Act
		cache.set('a', 1);
		cache.set('b', 2);

		// Assert
		expect(cache.size).toBe(2);
	});
});
