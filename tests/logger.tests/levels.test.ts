import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { Logger } from '../../src/logger';

describe('logger levels', () => {
	let testLogger: Logger;
	let logCalls: any[] = [];
	const mockLogFn = (params: any) => {
		logCalls.push(params);
	};

	beforeEach(() => {
		logCalls = [];
		testLogger = new Logger();
		testLogger.init(mockLogFn as any);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it.each([
		['debug', 'debug msg'],
		['info', 'info msg'],
		['warn', 'warn msg'],
		['error', 'error msg'],
	])('{logger.%s} message "%s" → emits %s level', async (level, msg) => {
		// Arrange: (already done in beforeEach)

		// Act
		await (testLogger as any)[level]({ message: msg });

		// Assert
		expect(logCalls).toHaveLength(1);
		expect(logCalls[0].body.level).toBe(level);
	});

	it('{logger._log} any level → includes service name "gh-cli-wrapper"', async () => {
		// Arrange: (already done in beforeEach)

		// Act
		await testLogger.error({ message: 'any msg' });

		// Assert
		expect(logCalls).toHaveLength(1);
		expect(logCalls[0].body.service).toBe('gh-cli-wrapper');
	});

	it('{logger._log} without init → falls back to console[level]', async () => {
		// Arrange
		const freshLogger = new Logger();
		const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

		// Act
		await freshLogger.debug({ message: 'uninitialized msg' });

		// Assert
		expect(consoleSpy).toHaveBeenCalledWith('[gh-cli-wrapper] uninitialized msg');
	});

	it('{logger._log} when logFn throws → degrades to console.error', async () => {
		// Arrange
		const errLogFn = vi.fn().mockRejectedValue(new Error('sink broken'));
		const brokenLogger = new Logger();
		brokenLogger.init(errLogFn as any);
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		// Act
		await brokenLogger.info({ message: 'test' });

		// Assert
		expect(errorSpy).toHaveBeenCalledWith('log sink error: sink broken');
	});
});
