import {afterEach, beforeEach, describe, expect, it, vi} from 'bun:test';
import {DEFAULT_CONFIG_TIMEOUT_MS, loadConfig} from '../../src/config';

// ---------------------------------------------------------------------------
// Mock functions
// ---------------------------------------------------------------------------
const mockReadFile = vi.fn();
const mockJoin = vi.fn((...args: string[]) => args.join('/'));
const mockBasename = vi.fn((p: string) => p.split('/').pop() ?? p);

void vi.mock('fs', () => ({
	promises: { readFile: mockReadFile },
}));

void vi.mock('path', () => ({
	default: { join: mockJoin, resolve: (p: string) => p, basename: mockBasename },
}));

describe('loadConfig', () => {
	beforeEach(() => {
		mockReadFile.mockClear();
		mockJoin.mockClear();
		mockBasename.mockClear();
		mockJoin.mockImplementation((...args: string[]) => args.join('/'));
	});

	afterEach(() => {
		vi.resetAllMocks();
		delete process.env.GH_APPS_CONFIG_PATH;
	});

	describe('path resolution', () => {
		it('{loadConfig} no GH_APPS_CONFIG_PATH → reads from default path', async () => {
			// Arrange
			mockJoin.mockReturnValue('/fake/cwd/.opencode/gh-apps.json');
			mockReadFile.mockResolvedValue(JSON.stringify({
				apps: [{ name: 'test-app' }],
			}));

			// Act
			const config = await loadConfig();

			// Assert
			expect(config.apps).toHaveLength(1);
			expect(config.apps[0].name).toBe('test-app');
			expect(config.timeout_ms).toBe(DEFAULT_CONFIG_TIMEOUT_MS);
		});

		it('{loadConfig} GH_APPS_CONFIG_PATH set → reads from custom path', async () => {
			// Arrange
			process.env.GH_APPS_CONFIG_PATH = '/custom/path/config.json';
			mockReadFile.mockResolvedValue(JSON.stringify({
				apps: [{ name: 'custom-app' }],
			}));

			// Act
			const config = await loadConfig();

			// Assert
			expect(config.apps).toHaveLength(1);
			expect(config.apps[0].name).toBe('custom-app');
		});
	});

	describe('error handling', () => {
		it.each([
			['File not found', 'Configuration file not found'],
			['not valid json {', 'Configuration file'],
			['{}', 'Configuration file'], // missing apps key
			['{"timeout_ms": 0, "apps": [{"name": "test"}]}', 'Configuration file'], // zero timeout
			['{"apps": [{"name": ""}]}', 'Configuration file'], // empty app name
			['{"timeout_ms": 0.5, "apps": [{"name": "test"}]}', 'Configuration file'], // float timeout
		])('{loadConfig} input "%s" → throws /%s/', (input, expectedError) => {
			// Arrange — "File not found" is special: it's an ENOENT error thrown by readFile,
			// while all other cases are validation errors from Zod after the file content is parsed.
			if (input === 'File not found') {
				const enoent = Object.assign(new Error('File not found'), { code: 'ENOENT' });
				mockReadFile.mockRejectedValue(enoent);
			} else {
				mockReadFile.mockResolvedValue(input);
			}

			// Act & Assert
			expect(loadConfig()).rejects.toThrow(new RegExp(expectedError));
		});
	});

	describe('configuration values', () => {
		it('{loadConfig} app timeout_ms override → applied', async () => {
			// Arrange — three-tier precedence: app-level timeout_ms overrides global,
			// omitted app-level stays undefined (falls back to global at execution time).
			mockReadFile.mockResolvedValue(JSON.stringify({
				timeout_ms: 60000,
				apps: [
					{ name: 'fast-app', timeout_ms: 10000 },
					{ name: 'slow-app' },
				],
			}));

			// Act
			const config = await loadConfig();

			// Assert
			expect(config.timeout_ms).toBe(60000);
			expect(config.apps[0].timeout_ms).toBe(10000);
			expect(config.apps[1].timeout_ms).toBeUndefined();
		});

		it('{loadConfig} omitted global timeout_ms → uses default', async () => {
			// Arrange
			mockReadFile.mockResolvedValue(JSON.stringify({
				apps: [{ name: 'test-app' }],
			}));

			// Act
			const config = await loadConfig();

			// Assert
			expect(config.timeout_ms).toBe(DEFAULT_CONFIG_TIMEOUT_MS);
		});

		it('{loadConfig} custom global timeout_ms → used', async () => {
			global.console.warn = vi.fn();
			// Arrange
			mockReadFile.mockResolvedValue(JSON.stringify({
				timeout_ms: 30000,
				apps: [{ name: 'test-app' }],
			}));

			// Act
			const config = await loadConfig();

			// Assert
			expect(config.timeout_ms).toBe(30000);
		});
	});

	describe('edge cases', () => {
		it('{loadConfig} empty apps array → accepted', async () => {
			// Arrange
			mockReadFile.mockResolvedValue(JSON.stringify({ apps: [] }));

			// Act
			const config = await loadConfig();

			// Assert
			expect(config.apps).toEqual([]);
		});

		it('{loadConfig} preserve description field → accepted', async () => {
			// Arrange
			mockReadFile.mockResolvedValue(JSON.stringify({
				apps: [{ name: 'desc-test', description: 'A test app' }],
			}));

			// Act
			const config = await loadConfig();

			// Assert
			expect(config.apps[0].description).toBe('A test app');
		});
	});
});
