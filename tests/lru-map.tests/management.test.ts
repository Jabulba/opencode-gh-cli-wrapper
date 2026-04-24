import { describe, it, expect } from 'bun:test';
import { LruMap } from '../../src/lru-map';

describe('LruMap management', () => {
	it('{delete} existing key → removes key and returns true', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);
		cache.set('a', 1);
		cache.set('b', 2);
		expect(cache.size).toBe(2);

		// Act
		const result = cache.delete('a');

		// Assert
		expect(result).toBe(true);
		expect(cache.has('a')).toBe(false);
		expect(cache.size).toBe(1);
		expect(cache.get('a')).toBeUndefined();
	});

	it('{delete} missing key → returns false', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);

		// Act
		const result = cache.delete('missing');

		// Assert
		expect(result).toBe(false);
	});

	it('{delete} then {set} same key → restores key', () => {
		// Arrange
		const cache = new LruMap<string, number>(2);
		cache.set('a', 1);
		cache.set('b', 2);

		// Act
		cache.delete('a');
		cache.set('a', 10);

		// Assert
		expect(cache.get('a')).toBe(10);
		expect(cache.size).toBe(2);
	});

	it('{clear} populated cache → removes all entries', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);
		expect(cache.size).toBe(3);

		// Act
		cache.clear();

		// Assert
		expect(cache.size).toBe(0);
		expect(cache.has('a')).toBe(false);
		expect(cache.has('b')).toBe(false);
		expect(cache.has('c')).toBe(false);
	});

	it('{clear} empty cache → does not throw', () => {
		// Arrange
		const cache = new LruMap<string, number>(10);

		// Act
		const act = () => cache.clear();

		// Assert
		expect(act).not.toThrow();
		expect(cache.size).toBe(0);
	});
});
