import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';

// ---------------------------------------------------------------------------
// Shared mock utilities — imported at top so functions are in scope for vi.mock()
// ---------------------------------------------------------------------------

import { createIntegrationMocks, resetIntegrationMocks } from '../test-utils/integration-mocks';
import { makePluginInput } from '../test-utils/context-factories';
import { cleanupEnv } from '../test-utils/env';
import { setupMainModuleMocks } from '../test-utils/module-mocks';

// ---------------------------------------------------------------------------
// Mocks — file-scoped, per-test-file instances
// ---------------------------------------------------------------------------

const { mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth, mockSpawn } = createIntegrationMocks();

setupMainModuleMocks({ mockFsReadFile, mockAppCtor });

import { GitHubCLIWrapper } from '../../src/main';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GitHubCLIWrapper registration', () => {
	beforeEach(() => {
		global.console.warn = vi.fn();
		resetIntegrationMocks(mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth, mockSpawn);
		(Bun as any).spawn = mockSpawn;
	});

	afterEach(() => {
		cleanupEnv();
		vi.resetAllMocks();
	});

	describe('tool registration', () => {
		it('{GitHubCLIWrapper} empty apps array → registers no tools', async () => {
			// Arrange
			mockFsReadFile.mockResolvedValue(JSON.stringify({ apps: [] }));

			// Act
			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Assert
			expect(Object.keys(plugin.tool!)).toHaveLength(0);
		});

		it('{GitHubCLIWrapper} valid config → registers tools with correct names and descriptions', async () => {
			// Arrange — 6 env vars across 2 app suffixes (APP_ONE, APP_TWO).
			// Each app needs 3 vars: GH_APP_ID_{SUFFIX}, GH_INSTALL_ID_{SUFFIX}, GH_PEM_PATH_{SUFFIX}.
			process.env[`GH_APP_ID_APP_ONE`] = '1';
			process.env[`GH_INSTALL_ID_APP_ONE`] = '1';
			process.env[`GH_PEM_PATH_APP_ONE`] = '/1';
			process.env[`GH_APP_ID_APP_TWO`] = '2';
			process.env[`GH_INSTALL_ID_APP_TWO`] = '2';
			process.env[`GH_PEM_PATH_APP_TWO`] = '/2';

			mockFsReadFile.mockResolvedValue(JSON.stringify({
				apps: [
					{ name: 'app-one', description: 'First app' },
					{ name: 'app-two' }, // no description — should default to the built-in string
				],
			}));

			// Act
			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Assert — tool names are prefixed with `gh-`; description defaults when omitted.
			expect(plugin.tool).toHaveProperty('gh-app-one');
			expect(plugin.tool).toHaveProperty('gh-app-two');
			expect((plugin.tool!['gh-app-one'] as any).description).toBe('First app');
			expect((plugin.tool!['gh-app-two'] as any).description).toBe('GitHub CLI, Work seamlessly with GitHub from the command line.');
			expect(Object.keys(plugin.tool!)).toHaveLength(2);
		});
	});

	describe('error handling', () => {
		it('{GitHubCLIWrapper} file read failure → throws ConfigError', () => {
			// Arrange
			mockFsReadFile.mockRejectedValue(new Error('EACCES: permission denied'));

			// Act & Assert
			expect(GitHubCLIWrapper(makePluginInput())).rejects.toThrow(/Failed to read configuration file/);
		});

		it('{GitHubCLIWrapper} malformed JSON → throws ConfigError', () => {
			// Arrange
			mockFsReadFile.mockResolvedValue('not valid json {{{');

			// Act & Assert
			expect(GitHubCLIWrapper(makePluginInput())).rejects.toThrow(/invalid JSON/);
		});
	});
});
