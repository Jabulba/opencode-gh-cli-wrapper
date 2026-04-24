import { describe, it, expect } from 'bun:test';
import { EnvConfigSchema } from '../../src/token-provider';

describe('EnvConfigSchema', () => {
	it('{EnvConfigSchema} valid input → passes', () => {
		// Arrange
		const input = {
			appId: '123',
			installId: 456,
			pemPath: '/path/to/key.pem',
		};

		// Act
		const result = EnvConfigSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.appId).toBe('123');
			expect(result.data.installId).toBe(456);
			expect(result.data.pemPath).toBe('/path/to/key.pem');
		}
	});

	it('{EnvConfigSchema} installId string → coerces to number', () => {
		// Arrange
		const input = {
			appId: '123',
			installId: '456',
			pemPath: '/path/to/key.pem',
		};

		// Act
		const result = EnvConfigSchema.safeParse(input);

		// Assert
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.installId).toBe(456);
			expect(typeof result.data.installId).toBe('number');
		}
	});

	it.each([
		[{ appId: '', installId: 456, pemPath: '/path/to/key.pem' }, 'empty appId'],
		[{ appId: null, installId: 456, pemPath: '/path/to/key.pem' }, 'null appId'],
		[{ appId: '123', installId: 0, pemPath: '/path/to/key.pem' }, 'zero installId'],
		[{ appId: '123', installId: -1, pemPath: '/path/to/key.pem' }, 'negative installId'],
		[{ appId: '123', installId: 456, pemPath: '' }, 'empty pemPath'],
		[{ appId: '123', installId: 456 }, 'missing pemPath'],
		[{ installId: 456, pemPath: '/path/to/key.pem' }, 'missing appId'],
		[{ appId: '123', pemPath: '/path/to/key.pem' }, 'missing installId'],
	])('{EnvConfigSchema} %s → rejects', (input, _description) => {
		// Act
		const result = EnvConfigSchema.safeParse(input as any);

		// Assert
		expect(result.success).toBe(false);
	});
});
