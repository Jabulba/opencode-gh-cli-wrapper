import { describe, it, expect, afterEach, vi } from 'bun:test';
import { getEnvSuffix } from '../../src/utils';

describe('getEnvSuffix', () => {
	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('positive cases', () => {
		it.each([
			['my-app', 'MY_APP'],
			['example', 'EXAMPLE'],
			['My-APP', 'MY_APP'],
			['my_app', 'MY_APP'],
			['app2-test', 'APP2_TEST'],
			['MY_APP', 'MY_APP'],
		])('{getEnvSuffix} input "%s" → returns %s', (input, expected) => {
			// Arrange: input is provided in the table

			// Act: Convert the string to screaming snake case
			const result = getEnvSuffix(input);

			// Assert: Verify the output matches the expected suffix
			expect(result).toBe(expected);
		});
	});

	describe('edge cases', () => {
		it.each([
			['', ''],
			[' ', ' '],
			['\t', '\t'],
			['a', 'A'],
			['with-dash-and_underscore', 'WITH_DASH_AND_UNDERSCORE'],
			['multiple---dashes', 'MULTIPLE___DASHES'],
			['already_UPPER', 'ALREADY_UPPER'],
			['CamelCase', 'CAMELCASE'],
			['snake_case', 'SNAKE_CASE'],
			['kebab-case', 'KEBAB_CASE'],
			['mixed-Camel-case', 'MIXED_CAMEL_CASE'],
			['123', '123'],
			['app-123-test', 'APP_123_TEST'],
			['!@#$%^&*()', '!@#$%^&*()'],
			['  spaces-around  ', '  SPACES_AROUND  '],
			['a-b-c-d-e-f-g-h-i-j-k-l-m-n-o-p-q-r-s-t-u-v-w-x-y-z',
				'A_B_C_D_E_F_G_H_I_J_K_L_M_N_O_P_Q_R_S_T_U_V_W_X_Y_Z'],
		])('{getEnvSuffix} input "%s" → returns %s', (input, expected) => {
			// Arrange: input is provided in the table

			// Act: Convert the string and verify the output
			const result = getEnvSuffix(input);

			// Assert: Verify the output matches the expected suffix
			expect(result).toBe(expected);
		});

		it('{getEnvSuffix} very long string (10000 chars) → returns uppercased string of same length', () => {
			// Arrange: Build a 10000-character string with hyphens
			const input = 'a'.repeat(10000);

			// Act: Convert the very long string
			const result = getEnvSuffix(input);

			// Assert: Verify the output is uppercased and same length
			expect(result).toHaveLength(10000);
			expect(result).toBe('A'.repeat(10000));
		});
	});

	describe('error paths', () => {
		it('{getEnvSuffix} null input → throws TypeError', () => {
			// Arrange: null is not a valid string

			// Act & Assert: Calling getEnvSuffix with null should throw
			expect(() => getEnvSuffix(null as unknown as string)).toThrow(TypeError);
		});

		it('{getEnvSuffix} undefined input → throws TypeError', () => {
			// Arrange: undefined is not a valid string

			// Act & Assert: Calling getEnvSuffix with undefined should throw
			expect(() => getEnvSuffix(undefined as unknown as string)).toThrow(TypeError);
		});

		it('{getEnvSuffix} number input → throws TypeError', () => {
			// Arrange: a number is not a valid string

			// Act & Assert: Calling getEnvSuffix with a number should throw
			expect(() => getEnvSuffix(42 as unknown as string)).toThrow(TypeError);
		});

		it('{getEnvSuffix} object input → throws TypeError', () => {
			// Arrange: an object is not a valid string

			// Act & Assert: Calling getEnvSuffix with an object should throw
			expect(() => getEnvSuffix({} as unknown as string)).toThrow(TypeError);
		});
	});
});
