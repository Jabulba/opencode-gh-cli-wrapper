import { describe, it, expect } from 'bun:test';
import { LruMap } from '../../src/lru-map';

describe('LruMap eviction logic', () => {
	it('{set} capacity exceeded → evicts oldest entry', () => {
		// Arrange
		const cache = new LruMap<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Act
		cache.set('d', 4);

		// Assert
		expect(cache.size).toBe(3);
		expect(cache.has('a')).toBe(false); // oldest evicted
		expect(cache.has('b')).toBe(true);
		expect(cache.has('c')).toBe(true);
		expect(cache.has('d')).toBe(true);
	});

	it('{get} moves key to MRU → prevents its eviction', () => {
		// Arrange
		const cache = new LruMap<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Act
		cache.get('a'); // 'a' becomes MRU, 'b' becomes oldest
		cache.set('d', 4);

		// Assert
		expect(cache.has('a')).toBe(true);
		expect(cache.has('b')).toBe(false); // 'b' evicted
		expect(cache.has('c')).toBe(true);
		expect(cache.has('d')).toBe(true);
	});

	it('{set} existing key → moves to MRU and prevents its eviction', () => {
		// Arrange
		const cache = new LruMap<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Act
		cache.set('a', 10); // 'a' becomes MRU, 'b' becomes oldest
		cache.set('d', 4);

		// Assert
		expect(cache.get('a')).toBe(10);
		expect(cache.has('b')).toBe(false); // 'b' evicted
		expect(cache.has('c')).toBe(true);
		expect(cache.has('d')).toBe(true);
	});

	it('{has} access → does not change access order', () => {
		// Arrange — 'a' is the LRU candidate (inserted first).
		const cache = new LruMap<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Act — has() is read-only: it must NOT promote 'a' to MRU.
		cache.has('a');
		cache.set('d', 4); // triggers eviction of the oldest entry

		// Assert — 'a' was NOT promoted, so it's still the LRU and gets evicted.
		expect(cache.has('a')).toBe(false);
		expect(cache.has('c')).toBe(true);
	});

	it('{peek} access → does not change access order', () => {
		// Arrange — same setup: 'a' is LRU candidate.
		const cache = new LruMap<string, number>(3);
		cache.set('a', 1);
		cache.set('b', 2);
		cache.set('c', 3);

		// Act — peek() is read-only: it must NOT promote 'a' to MRU.
		cache.peek('a');
		cache.set('d', 4); // triggers eviction of the oldest entry

		// Assert — 'a' was NOT promoted, so it's evicted; peek('a') returns undefined.
		expect(cache.peek('a')).toBeUndefined();
		expect(cache.peek('c')).toBe(3);
	});
});
