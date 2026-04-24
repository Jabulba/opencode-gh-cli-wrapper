// Copyright (c) 2026 Jabulba. MIT License.
/**
 * Implements the Least Recently Used (LRU) cache mechanism over the native Map.
 * It automatically evicts the least recently accessed item when the maximum size is exceeded.
 *
 * Uses composition over inheritance to avoid LSP violation. The internal Map
 * provides storage; this class manages LRU reorder and eviction semantics.
 *
 * @template K The type of the keys stored in the map.
 * @template V The type of the values stored in the map.
 */
export class LruMap<K, V> {
	readonly #maxSize: number;
	readonly #map = new Map<K, V>();

	/**
	 * Constructs a new LRU cache with the specified maximum size.
	 *
	 * @param maxSize The maximum number of entries. Must be a positive integer.
	 * @throws {RangeError} If maxSize is not positive.
	 */
	constructor(maxSize: number = 100) {
		if (!Number.isInteger(maxSize) || maxSize <= 0) {
			throw new RangeError(`maxSize must be a positive integer, got ${maxSize}`);
		}
		this.#maxSize = maxSize;
	}

	/**
	 * Sets a key-value pair in the cache. If the key already exists, it is moved
	 * to the most recently used position. If adding the new entry causes the cache
	 * size to exceed the maximum size, the least recently used entry is evicted.
	 *
	 * @param key The key to set.
	 * @param value The value associated with the key.
	 */
	set(key: K, value: V): void {
		if (this.#map.has(key)) this.#map.delete(key); // delete+re-set moves key to MRU position
		this.#map.set(key, value);
		if (this.#map.size > this.#maxSize) {
			// Map preserves insertion order; first entry is the LRU candidate.
			const firstKey = this.#map.keys().next().value;
			if (firstKey !== undefined) {
				this.#map.delete(firstKey);
			}
		}
	}

	/**
	 * Retrieves a value associated with the specified key, moving the entry to
	 * the end of the cache (most recently used) if found.
	 *
	 * @param key The key whose associated value is to be retrieved.
	 * @returns The value associated with the key, or undefined if not found.
	 */
	get(key: K): V | undefined {
		if (this.#map.has(key)) {
			const value = this.#map.get(key)!; // safe: just checked has() above
			this.#map.delete(key);
			this.#map.set(key, value); // move to MRU position
			return value;
		}
		return undefined;
	}

	/**
	 * Checks if a key exists in the cache without changing its access order.
	 *
	 * @param key The key to check.
	 * @returns Whether the key exists in the cache.
	 */
	has(key: K): boolean {
		return this.#map.has(key);
	}

	/**
	 * Retrieves the value associated with the specified key without changing
	 * its access order (does not move to most-recently-used).
	 *
	 * @param key The key whose associated value is to be retrieved.
	 * @returns The value associated with the key, or undefined if not found.
	 */
	peek(key: K): V | undefined {
		return this.#map.get(key);
	}

	/**
	 * The current number of entries in the cache.
	 */
	get size(): number {
		return this.#map.size;
	}

	/**
	 * Removes a key from the cache.
	 *
	 * @param key The key to remove.
	 * @returns true if the key existed and was removed.
	 */
	delete(key: K): boolean {
		return this.#map.delete(key);
	}

	/**
	 * Removes all entries from the cache.
	 */
	clear(): void {
		this.#map.clear();
	}
}
