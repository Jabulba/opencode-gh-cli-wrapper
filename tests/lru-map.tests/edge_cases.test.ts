import { describe, it, expect } from 'bun:test';
import { LruMap } from '../../src/lru-map';

describe('LruMap edge cases', () => {
	it('{set} undefined value → moves to MRU and prevents eviction', () => {
		// Arrange
		const cache = new LruMap<string, number | undefined>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);
		cache.set('a', undefined); // 'a' becomes MRU

		// Act
		cache.set('d', 4); // 'b' should be evicted

		// Assert
		expect(cache.has('a')).toBe(true);
		expect(cache.has('b')).toBe(false);
		expect(cache.has('c')).toBe(true);
		expect(cache.has('d')).toBe(true);
	});

	it.each(['forEach', 'entries', 'values', 'keys'])(`{LruMap} property "%s" → is not exposed`, (methodName) => {
		// Arrange
		const cache = new LruMap<string, number>(10);
		const prototype = Object.getPrototypeOf(cache);

		// Act
		const propertyNames = Object.getOwnPropertyNames(prototype);

		// Assert
		expect(propertyNames).not.toContain(methodName);
	});
});
