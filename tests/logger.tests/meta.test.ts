import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { Logger } from '../../src/logger';

describe('logger meta', () => {
	let testLogger: Logger;
	const mockLogFn = vi.fn();

	beforeEach(() => {
		mockLogFn.mockClear();
		testLogger = new Logger();
		testLogger.init(mockLogFn as any);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it('{logger._log} with complex meta → passes types through directly', async () => {
		// Arrange
		const meta = {
			obj: { nested: true },
			arr: [1, 2],
			nullVal: null,
			str: 'hello',
			num: 42,
			bool: true,
		};

		// Act
		await testLogger.info({
			message: 'test meta',
			meta,
		});

		// Assert
		const extra = mockLogFn.mock.calls[0][0].body.extra;
		expect(extra.obj).toEqual({ nested: true });
		expect(extra.arr).toEqual([1, 2]);
		expect(extra.nullVal).toBe(null);
		expect(extra.str).toBe('hello');
		expect(extra.num).toBe(42);
		expect(extra.bool).toBe(true);
	});
});
