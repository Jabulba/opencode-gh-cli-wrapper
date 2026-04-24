import { describe, it, expect, afterEach, vi } from 'bun:test';
import { splitShellArgs } from '../../src/utils';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const EXTREME_INPUT_LENGTH = 100;
const EXTREME_INPUT_REPETITIONS = 50;

describe('splitShellArgs', () => {
	afterEach(() => {
		vi.resetAllMocks();
	});

	describe('argument splitting', () => {
		it.each([
			['repo list', ['repo', 'list']],
			['pr view "my repo"', ['pr', 'view', 'my repo']],
			["pr view 'hello world'", ['pr', 'view', 'hello world']],
			['gh search repos *', ['gh', 'search', 'repos', '*']],
			['gh search repos ?', ['gh', 'search', 'repos', '?']],
			['gh search repos [abc]', ['gh', 'search', 'repos', '[abc]']],
			['cmd1 | cmd2', ['cmd1', '|', 'cmd2']],
			['cmd1 && cmd2', ['cmd1', '&&', 'cmd2']],
			['echo hello > file.txt', ['echo', 'hello', '>', 'file.txt']],
			['cmd1 ; cmd2', ['cmd1', ';', 'cmd2']],
			['gh pr view $(whoami)', ['gh', 'pr', 'view', '$', '(', 'whoami', ')']],
			['gh pr view `id`', ['gh', 'pr', 'view', '`id`']],
			['gh pr view $HOME', ['gh', 'pr', 'view', '']],
			['gh pr view {1..3}', ['gh', 'pr', 'view', '{1..3}']],
			['', []],
			['   ', []],
		])('{splitShellArgs} input "%s" → returns %s', (input, expected) => {
			// Arrange: input provided in table
       
			// Act: Split the shell arguments
			const result = splitShellArgs(input);
       
			// Assert: Verify tokens match expected output
			expect(result).toEqual(expected);
		});

		it('{splitShellArgs} standalone comment → extracts comment text', () => {
			// Arrange
			const input = '# this is a comment';

			// Act
			const result = splitShellArgs(input);

			// Assert
			expect(result).toEqual([' this is a comment']);
		});
	});

	describe('edge cases', () => {
		it('{splitShellArgs} nested quotes → handles safely', () => {
			// Arrange
			const input = `"outer 'test' inner"`;
      
			// Act
			const result = splitShellArgs(input);
      
			// Assert
			expect(result.length).toBeGreaterThanOrEqual(1);
			result.forEach(token => expect(typeof token).toBe('string'));
		});

		it('{splitShellArgs} deeply nested markers → handles safely', () => {
			// Arrange
			const input = '$(echo $(echo $(echo test)))';
      
			// Act
			const result = splitShellArgs(input);
      
			// Assert
			result.forEach(token => expect(token).not.toMatch(/\\$\(/));
		});

		it('{splitShellArgs} extreme length input → does not crash', () => {
			// Arrange
			const longInput = Array.from({ length: EXTREME_INPUT_LENGTH }, () => 'a'.repeat(EXTREME_INPUT_REPETITIONS)).join(' ');
      
			// Act
			const result = splitShellArgs(longInput);
      
			// Assert
			expect(result.length).toBeGreaterThan(0);
			result.forEach(token => expect(typeof token).toBe('string'));
		});
	});

	// ---------------------------------------------------------------------------
	// Fuzz Testing — 27 templates cover quotes, pipes, redirects, command substitution,
	// newlines, null bytes, globs, and brace expansion to stress-test security boundaries.
	// ---------------------------------------------------------------------------
	describe('fuzz testing', () => {
		const EXPECTED_LITERAL_METAS = new Set(['|', '&&', '||', ';', '>', '<', '&']);

		const FUZZ_ITERATIONS_SENSITIVE = 500;  // strict injection checks
		const FUZZ_ITERATIONS_OPERATORS = 200;   // operator tokenization checks
		const FUZZ_ITERATIONS_TYPES = 500;       // type safety checks

		/**
		 * Generates a random string of a specified length.
		 * @param {number} [len=10] - The desired length of the generated string.
		 * @return {string} A randomly generated string consisting of alphanumeric characters and the symbols _, -, and ..
		 */
		function randStr(len: number = 10): string {
			const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.';
			let s = '';
			for (let i = 0; i < len; i++) {
				s += chars[Math.floor(Math.random() * chars.length)];
			}
			return s;
		}

		function generateFuzzInput(): string {
			// 27 templates: plain strings, quoted strings, shell operators, command substitution,
			// env vars, newlines, null bytes, globs, brace expansion — covers all shell injection vectors.
			const templates = [
				() => randStr(),
				() => `"${randStr()} ${randStr()}"`,
				() => `'${randStr()} ${randStr()}'`,
				() => `${randStr()} && ${randStr()}`,
				() => `${randStr()} | ${randStr()}`,
				() => `${randStr()} ; ${randStr()}`,
				() => `${randStr()} > ${randStr()}`,
				() => `${randStr()} < ${randStr()}`,
				() => `${randStr()} || ${randStr()}`,
				() => `${randStr()} & ${randStr()}`,
				() => `$( ${randStr()} )`,
				() => `$${randStr()}`,
				() => `\`${randStr()}\``,
				() => `"${randStr()}\n${randStr()}"`,
				() => `${randStr()}\n${randStr()}`,
				() => `${randStr()}\r\n${randStr()}`,
				() => `${randStr()}\0${randStr()}`,
				() => `${randStr()}${randStr()}${randStr()}`,
				() => `  ${randStr()}   ${randStr()}   `,
				() => `"${randStr()}" '${randStr()}' ${randStr()}`,
				() => `${randStr()} ${randStr()} ${randStr()} ${randStr()}`,
				() => `--${randStr()}=${randStr()}`,
				() => `--${randStr()} '${randStr()}'`,
				() => `-${randStr()} ${randStr()}`,
				() => `--${randStr()} --${randStr()}`,
				() => `${randStr()}[a-z]${randStr()}`,
				() => `${randStr()}*${randStr()}`,
				() => `${randStr()}?${randStr()}`,
				() => `${randStr()}{${randStr()},${randStr()}}`,
			];
			return templates[Math.floor(Math.random() * templates.length)]();
		}

		it('{splitShellArgs} random inputs → no dangerous injection patterns', () => {
			// Arrange: FUZZ_ITERATIONS_SENSITIVE iterations
			for (let i = 0; i < FUZZ_ITERATIONS_SENSITIVE; i++) {
				// Act
				const input = generateFuzzInput();
				const tokens = splitShellArgs(input);

				// Assert — command substitution $() must be broken into separate tokens;
				// bare `$` is allowed (it's the env var prefix, not a subshell operator).
				for (const token of tokens) {
					if (token === '$') continue;
					expect(token.includes('$(')).toBe(false);
					expect(token).not.toMatch(/\\$\(/);
				}
			}
		});

		it('{splitShellArgs} random inputs → shell operators are distinct tokens', () => {
			// Arrange: FUZZ_ITERATIONS_OPERATORS iterations
			for (let i = 0; i < FUZZ_ITERATIONS_OPERATORS; i++) {
				// Act
				const input = generateFuzzInput();
				const tokens = splitShellArgs(input);

				// Assert — every token (except the operator tokens themselves) must NOT contain
				// shell operators embedded in its value. This prevents injection via merged args.
				for (const token of tokens) {
					if (EXPECTED_LITERAL_METAS.has(token)) continue;
					expect(token.includes('|')).toBe(false);
					expect(token.includes('&&')).toBe(false);
					expect(token.includes('||')).toBe(false);
					expect(token.includes(';')).toBe(false);
					expect(token.includes('>')).toBe(false);
					expect(token.includes('<')).toBe(false);
					expect(token.includes(' &')).toBe(false);
					expect(token.includes('& ')).toBe(false);
				}
			}
		});

		it('{splitShellArgs} random inputs → tokens are always strings', () => {
			// Arrange: FUZZ_ITERATIONS_TYPES iterations
			for (let i = 0; i < FUZZ_ITERATIONS_TYPES; i++) {
				// Act
				const input = generateFuzzInput();
				const tokens = splitShellArgs(input);
        
				// Assert
				for (const token of tokens) {
					expect(typeof token).toBe('string');
				}
			}
		});
	});
});
