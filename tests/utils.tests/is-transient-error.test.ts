import { describe, it, expect } from 'bun:test';
import { isTransientError } from '../../src/utils';

describe('isTransientError', () => {
	describe('positive cases', () => {
		it.each([
			['ECONNRESET', 'connection reset', 'ECONNRESET'],
			['ECONNREFUSED', 'connection refused', 'ECONNREFUSED'],
			['ENOTFOUND', 'getaddrinfo ENOTFOUND', 'ENOTFOUND'],
			['EAI_AGAIN', 'getaddrinfo EAI_AGAIN', 'EAI_AGAIN'],
			['ETIMEDOUT', 'timed out', 'ETIMEDOUT'],
		])('{isTransientError} error code "%s" → returns true', (_, message, code) => {
			// Arrange
			const error = Object.assign(new Error(message), { code });
			// Act
			const result = isTransientError(error);
			// Assert
			expect(result).toBe(true);
		});

		it.each([
			['HTTP 429 Too Many Requests'],
			['HTTP 502 Bad Gateway'],
			['HTTP 503 Service Unavailable'],
			['HTTP 504 Gateway Timeout'],
			['http 429 too many requests'],
		])('{isTransientError} message "%s" → returns true', (message) => {
			// Arrange
			const error = new Error(message);
			// Act
			const result = isTransientError(error);
			// Assert
			expect(result).toBe(true);
		});

		it('{isTransientError} transient code in error cause → returns true', () => {
			// Arrange
			const cause = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
			const error = new Error('spawn failed', { cause });
			// Act
			const result = isTransientError(error);
			// Assert
			expect(result).toBe(true);
		});

		it('{isTransientError} transient code in cause message → returns true', () => {
			// Arrange
			const cause = new Error('ECONNREFUSED');
			const error = new Error('spawn failed', { cause });
			// Act
			const result = isTransientError(error);
			// Assert
			expect(result).toBe(true);
		});

		it('{isTransientError} transient HTTP code in cause message → returns true', () => {
			// Arrange
			const cause = new Error('HTTP 503');
			const error = new Error('upstream failed', { cause });
			// Act
			const result = isTransientError(error);
			// Assert
			expect(result).toBe(true);
		});
	});

	describe('negative cases', () => {
		it.each([
			['HTTP 401 Unauthorized'],
			['HTTP 403 Forbidden'],
			['HTTP 400 Bad Request'],
			['HTTP 200 OK'],
			['something broke'],
			[''],
		])('{isTransientError} message "%s" → returns false', (message) => {
			// Arrange
			const error = new Error(message);
			// Act
			const result = isTransientError(error);
			// Assert
			expect(result).toBe(false);
		});

		it('{isTransientError} TimeoutError name → returns false', () => {
			// Arrange
			const error = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
			// Act
			const result = isTransientError(error);
			// Assert
			expect(result).toBe(false);
		});

		it('{isTransientError} non-transient error code → returns false', () => {
			// Arrange
			const error = Object.assign(new Error('some error'), { code: 'EACCES' });
			// Act
			const result = isTransientError(error);
			// Assert
			expect(result).toBe(false);
		});

		it.each([
			['string error'],
			[null],
			[undefined],
			[42],
		])('{isTransientError} non-Error input "%s" → returns false', (input) => {
			// Act
			const result = isTransientError(input as any);
			// Assert
			expect(result).toBe(false);
		});
	});
});
