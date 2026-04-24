import { describe, it, expect } from 'bun:test';
import {
	AppError,
	ConfigError,
	PemReadError,
	TokenError,
	ToolError,
	EnvConfigError,
	type ErrorMetadata,
} from '../../src/errors';

// ---------------------------------------------------------------------------
// Constructor name tests (parameterized)
// ---------------------------------------------------------------------------
it.each([
	[ConfigError, 'ConfigError'],
	[PemReadError, 'PemReadError'],
	[TokenError, 'TokenError'],
	[ToolError, 'ToolError'],
	[EnvConfigError, 'EnvConfigError'],
])('%s constructor → correct name', (ErrorClass, expectedName) => {
	// Arrange
	const message = 'test message';

	// Act
	const error = new ErrorClass(message);

	// Assert
	expect(error.name).toBe(expectedName);
});

describe('errors functionality', () => {
	describe('AppError base class', () => {
		it('AppError constructor → instance of Error', () => {
			// Arrange
			const message = 'test message';

			// Act
			const error = new ConfigError(message);

			// Assert
			expect(error).toBeInstanceOf(Error);
			expect(error).toBeInstanceOf(AppError);
		});

		it('AppError constructor {cause} → preserves cause chain', () => {
			// Arrange
			const original = new Error('root cause');

			// Act
			const error = new ConfigError('wrapped', { cause: original });

			// Assert
			expect(error.cause).toBe(original);
		});

		it('AppError constructor {metadata} → stores metadata', () => {
			// Arrange
			const meta: ErrorMetadata = { configPath: '/some/path', appId: '123' };

			// Act
			const error = new ConfigError('test', { metadata: meta });

			// Assert
			expect(error).toBeDefined();
			expect(error.metadata).toEqual(meta);
		});

		it('AppError constructor without options → default values', () => {
			// Arrange
			const message = 'simple';

			// Act
			const error = new ConfigError(message);

			// Assert
			expect(error.message).toBe(message);
			expect(error.name).toBe('ConfigError');
			expect(error.metadata).toBeUndefined();
			expect(error.cause).toBeUndefined();
		});
	});

	describe('ToolError', () => {
		it('ToolError message → is user-friendly', () => {
			// Arrange
			const message = 'Command failed with exit code 1';

			// Act
			const error = new ToolError(message, { metadata: { toolName: 'gh-pr' } });

			// Assert
			expect(error.message).toBe(message);
		});
	});
});
