import { describe, it, expect } from 'bun:test';
import { runWithRetry } from '../../src/utils';

const NUM_RETRIES_2 = 2;
const MIN_DELAY_1 = 50;
const MAX_DELAY_1 = 75;
const MIN_DELAY_2 = 100;
const MAX_DELAY_2 = 150;

describe('runWithRetry', () => {
	it('{runWithRetry} succeeds on first try → returns result', async () => {
		// Arrange
		let callCount = 0;
		const task = async () => {
			callCount++;
			return Promise.resolve('success');
		};

		// Act
		const result = await runWithRetry(task, NUM_RETRIES_2, MIN_DELAY_1);

		// Assert
		expect(result).toBe('success');
		expect(callCount).toBe(1);
	});

	it('{runWithRetry} retries on transient error then succeeds → returns result', async () => {
		// Arrange
		const errors = [
			Object.assign(new Error('ECONNRESET'), { code: 'ECONNRESET' }),
			Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' }),
		];
		let callCount = 0;
		const task = async () => {
			callCount++;
			if (callCount < 3) {
				return Promise.reject(errors[callCount - 1]);
			}
			return Promise.resolve('recovered');
		};

		// Act
		const result = await runWithRetry(task, NUM_RETRIES_2, MIN_DELAY_1);

		// Assert
		expect(result).toBe('recovered');
		expect(callCount).toBe(3);
	});

	it.each([
		{
			// EACCES = permission denied — a permanent local error, not transient.
			name: 'non-retryable error (EACCES)',
			setup: () => Object.assign(new Error('EACCES'), { code: 'EACCES' }),
			expected: /EACCES/
		},
		{
			// TimeoutError = application-level timeout, not a network transient.
			name: 'TimeoutError',
			setup: () => Object.assign(new Error('timed out'), { name: 'TimeoutError' }),
			expected: /timed out/
		},
		{
			// HTTP 401 = auth failure — should be handled by token refresh, not retry.
			name: 'HTTP 401',
			setup: () => new Error('HTTP 401 Unauthorized'),
			expected: /401/
		}
	])('{runWithRetry} $name → not retried', ({ setup, expected }) => {
		// Arrange
		const error = setup();
		let callCount = 0;
		const task = async () => {
			callCount++;
			return Promise.reject(error);
		};

		// Act & Assert
		expect(runWithRetry(task, NUM_RETRIES_2, MIN_DELAY_1)).rejects.toThrow(expected);
		expect(callCount).toBe(1);
	});

	it('{runWithRetry} transient errors until exhaustion → throws error', () => {
		// Arrange
		const error = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
		let callCount = 0;
		const task = async () => {
			callCount++;
			return Promise.reject(error);
		};

		// Act & Assert
		expect(runWithRetry(task, NUM_RETRIES_2, MIN_DELAY_1)).rejects.toThrow(/ECONNREFUSED/);
		expect(callCount).toBe(3); // initial + 2 retries
	});

	it('{runWithRetry} maxRetries=0 → only one attempt', () => {
		// Arrange
		let callCount = 0;
		const error = Object.assign(new Error('fail'), { code: 'ECONNREFUSED' });
		const task = async () => {
			callCount++;
			return Promise.reject(error);
		};

		// Act & Assert
		expect(runWithRetry(task, 0, MIN_DELAY_1)).rejects.toThrow(/fail/);
		expect(callCount).toBe(1);
	});

	it('{runWithRetry} default maxRetries=2 → 3 attempts total', () => {
		// Arrange
		let callCount = 0;
		const error = Object.assign(new Error('fail'), { code: 'ECONNREFUSED' });
		const task = async () => {
			callCount++;
			return Promise.reject(error);
		};

		// Act & Assert
		expect(runWithRetry(task, NUM_RETRIES_2, MIN_DELAY_1)).rejects.toThrow(/fail/);
		expect(callCount).toBe(3);
	});

	it('{runWithRetry} retries → delays increase with exponential backoff', async () => {
		// Arrange — hijack global.setTimeout to capture the delay values without waiting for real timers.
		// The original setTimeout is called with 0ms so the test doesn't actually block.
		const delays: number[] = [];
		const originalSetTimeout = global.setTimeout;
		global.setTimeout = ((fn: () => void, ms: number) => {
			delays.push(ms);
			return originalSetTimeout(fn, 0);
		}) as typeof originalSetTimeout;

		const error = Object.assign(new Error('ECONNREFUSED'), { code: 'ECONNREFUSED' });
		let callCount = 0;
		const task = async () => {
			callCount++;
			if (callCount < 3) {
				return Promise.reject(error);
			}
			return Promise.resolve('recovered');
		};

		// Act
		await runWithRetry(task, NUM_RETRIES_2, MIN_DELAY_1);

		// Assert — 2 retries = 2 delays; each delay is baseDelay * 2^i + jitter,
		// so delay[0] ≈ 50-75ms, delay[1] ≈ 100-150ms, and delay[1] > delay[0].
		expect(callCount).toBe(3);
		expect(delays).toHaveLength(2);
		expect(delays[0]).toBeGreaterThanOrEqual(MIN_DELAY_1);
		expect(delays[0]).toBeLessThan(MAX_DELAY_1);
		expect(delays[1]).toBeGreaterThanOrEqual(MIN_DELAY_2);
		expect(delays[1]).toBeLessThan(MAX_DELAY_2);
		expect(delays[1]).toBeGreaterThan(delays[0]);

		// Cleanup — restore original setTimeout so other tests aren't affected.
		global.setTimeout = originalSetTimeout;
	});

	it('{runWithRetry} negative maxRetries → throws RangeError', () => {
		// Arrange
		let callCount = 0;
		const task = async () => {
			callCount++;
			return Promise.reject(new Error('never reached'));
		};

		// Act & Assert
		expect(runWithRetry(task, -1, MIN_DELAY_1)).rejects.toThrow(RangeError);
		expect(callCount).toBe(0);
	});
});
