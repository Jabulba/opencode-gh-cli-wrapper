import { describe, it, expect } from 'bun:test';
import { AppEntrySchema } from '../../src/config';

describe('name normalization', () => {
	it.each([
		['  My APp Näme  ', 'my-app-name'],
		['Café', 'cafe'],
		['my@app!', 'myapp'],
		['my-app', 'my-app'],
	])('{AppEntrySchema.parse} input "%s" → normalized to "%s"', (input, expected) => {
		// Arrange: input is provided by table
		
		// Act: parse the input
		const result = AppEntrySchema.parse({ name: input });
		
		// Assert: verify normalized name
		expect(result.name).toBe(expected);
	});
});

describe('name validation', () => {
	it.each([
		['', 'App name must not be empty'],
		['   ', 'App name must not be empty'],
		['a'.repeat(35), 'App name must not exceed 34 characters'],
	])('{AppEntrySchema.safeParse} input "%s" → throws %s', (input, expectedError) => {
		// Arrange: input is provided by table
		
		// Act: safeParse the input
		const result = AppEntrySchema.safeParse({ name: input });
		
		// Assert: verify failure and error message
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe(expectedError);
		}
	});

	it('{AppEntrySchema.parse} input with 34 characters → success', () => {
		// Arrange: setup 34 char name
		const name34 = 'a'.repeat(34);
		
		// Act: parse it
		const result = AppEntrySchema.parse({ name: name34 });
		
		// Assert: verify it is accepted
		expect(result.name).toBe(name34);
	});
});

describe('required fields', () => {
	it('{AppEntrySchema.safeParse} input without name → throws error', () => {
		// Arrange: setup input missing required field
		const input = { description: 'missing name' };
		
		// Act: parse it
		const result = AppEntrySchema.safeParse(input);
		
		// Assert: verify failure
		expect(result.success).toBe(false);
	});
});

describe('description validation', () => {
	it('{AppEntrySchema.parse} valid description → success', () => {
		// Arrange: setup valid input
		const input = { name: 'myapp', description: 'A great app' };
		
		// Act: parse it
		const result = AppEntrySchema.parse(input);
		
		// Assert: verify result
		expect(result.description).toBe('A great app');
	});

	it('{AppEntrySchema.safeParse} invalid description type → throws error', () => {
		// Arrange: setup invalid input
		const input = { name: 'myapp', description: 123 };
		
		// Act: parse it
		const result = AppEntrySchema.safeParse(input);
		
		// Assert: verify failure
		expect(result.success).toBe(false);
	});
});

describe('timeout_ms validation', () => {
	it('{AppEntrySchema.parse} valid timeout_ms → success', () => {
		// Arrange: setup valid input
		const input = { name: 'myapp', timeout_ms: 1000 };
		
		// Act: parse it
		const result = AppEntrySchema.parse(input);
		
		// Assert: verify result
		expect(result.timeout_ms).toBe(1000);
	});

	it.each([
		[-1000, 'Too small: expected number to be >0'],
		[0, 'Too small: expected number to be >0'],
		['1000', 'Invalid input: expected number, received string'],
		[1.5, 'Invalid input: expected int, received number'],
	])('{AppEntrySchema.safeParse} timeout_ms %s → throws error', (input, expectedError) => {
		// Arrange: setup input
		const data = { name: 'myapp', timeout_ms: input };
		
		// Act: parse it
		const result = AppEntrySchema.safeParse(data);
		
		// Assert: verify failure
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe(expectedError);
		}
	});
});

describe('full config parsing', () => {
	it('{AppEntrySchema.parse} full config with "My GitHub App" → normalized to "my-github-app"', () => {
		// Arrange: setup input
		const input = { name: 'My GitHub App' };
		
		// Act: parse it
		const result = AppEntrySchema.parse(input);
		
		// Assert: verify result
		expect(result.name).toBe('my-github-app');
	});
});
