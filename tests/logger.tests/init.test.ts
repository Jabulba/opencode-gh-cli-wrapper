import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { Logger } from '../../src/logger';

describe('logger init', () => {
	let testLogger: Logger;
	const mockLogFn = () => {
	};

	beforeEach(() => {
		testLogger = new Logger();
		testLogger.init(mockLogFn as any);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it('{logger.isInitialized} after init → returns true', () => {
		// Arrange: (done in beforeEach)

		// Act & Assert
		expect(testLogger.isInitialized).toBe(true);
	});

	it('{logger.isInitialized} before init → returns false', () => {
		// Arrange
		const freshLogger = new Logger();

		// Act & Assert
		expect(freshLogger.isInitialized).toBe(false);
	});

	it('{logger.init} multiple times → warns on console', () => {
		// Arrange
		const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

		// Act
		testLogger.init(mockLogFn as any);
		testLogger.init(mockLogFn as any);

		// Assert
		expect(warnSpy).toHaveBeenCalledWith('[logger] init called multiple times; previous logFn discarded');

		warnSpy.mockRestore();
	});

});
