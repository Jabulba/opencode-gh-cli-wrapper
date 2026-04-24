import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';

// ---------------------------------------------------------------------------
// Shared mock utilities — imported at top so functions are in scope for vi.mock()
// ---------------------------------------------------------------------------

import { createIntegrationMocks, resetIntegrationMocks } from '../test-utils/integration-mocks';
import { makePluginInput, makeToolContext } from '../test-utils/context-factories';
import { makeMockSubprocess } from '../test-utils/subprocess-mock';
import { cleanupEnv } from '../test-utils/env';
import { setupMainModuleMocks } from '../test-utils/module-mocks';
import { setupAppConfig } from '../test-utils/integration-setup';

// ---------------------------------------------------------------------------
// Mocks — file-scoped, per-test-file instances
// ---------------------------------------------------------------------------

const { mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth, mockSpawn } = createIntegrationMocks();

setupMainModuleMocks({ mockFsReadFile, mockAppCtor });

import { GitHubCLIWrapper } from '../../src/main';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GitHubCLIWrapper execution', () => {
	beforeEach(() => {
		resetIntegrationMocks(mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth, mockSpawn);
		(Bun as any).spawn = mockSpawn;
	});

	afterEach(() => {
		cleanupEnv();
		vi.resetAllMocks();
	});

	describe('tool execution', () => {
		it('{execute} correct args → returns stdout', async () => {
			// Arrange
			setupAppConfig('TEST', mockFsReadFile);
			mockAuth.mockResolvedValue({
				token: 'ghs_token123',
				expiresAt: '2099-01-01T00:00:00Z',
			});
			mockSpawn.mockReturnValue(makeMockSubprocess({ stdout: 'repo-list-output' }));

			const plugin = await GitHubCLIWrapper(makePluginInput());
			const execute = plugin.tool!['gh-test'].execute;

			// Act
			const result = await execute({ ghArgs: 'repo list' }, makeToolContext());

			// Assert
			expect(result).toBe('repo-list-output');
			expect(mockSpawn).toHaveBeenCalledWith(
				['gh', 'repo', 'list'],
				expect.objectContaining({
					env: expect.objectContaining({ GH_TOKEN: 'ghs_token123' }),
				}),
			);
		});

		it('{execute} per-app timeout_ms → applied to spawn', async () => {
			// Arrange
			setupAppConfig('FAST', mockFsReadFile);
			mockFsReadFile.mockResolvedValue(JSON.stringify({
				apps: [{ name: 'fast', timeout_ms: 5000 }],
			}));
			mockAuth.mockResolvedValue({
				token: 'ghs_fast',
				expiresAt: '2099-01-01T00:00:00Z',
			});
			mockSpawn.mockReturnValue(makeMockSubprocess());

			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Act
			await plugin.tool!['gh-fast'].execute({ ghArgs: '' }, makeToolContext());

			// Assert
			expect(mockSpawn).toHaveBeenCalledWith(
				['gh'],
				expect.objectContaining({ timeout: 5000 }),
			);
		});
	});

	describe('cwd propagation', () => {
		it('{execute} worktree set → uses worktree as cwd', async () => {
			// Arrange
			setupAppConfig('CWD', mockFsReadFile);
			mockAuth.mockResolvedValue({
				token: 'ghs_cwd',
				expiresAt: '2099-01-01T00:00:00Z',
			});
			mockSpawn.mockReturnValue(makeMockSubprocess());

			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Act
			await plugin.tool!['gh-cwd'].execute(
				{ ghArgs: 'cmd' },
				makeToolContext({ worktree: '/custom/worktree' }),
			);

			// Assert
			expect(mockSpawn).toHaveBeenCalledWith(
				['gh', 'cmd'],
				expect.objectContaining({ cwd: '/custom/worktree' }),
			);
		});

		it('{execute} worktree not set → falls back to directory', async () => {
			// Arrange
			setupAppConfig('CWD', mockFsReadFile);
			mockAuth.mockResolvedValue({
				token: 'ghs_cwd',
				expiresAt: '2099-01-01T00:00:00Z',
			});
			mockSpawn.mockReturnValue(makeMockSubprocess());

			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Act
			await plugin.tool!['gh-cwd'].execute(
				{ ghArgs: 'cmd' },
				makeToolContext({ worktree: undefined, directory: '/fallback/dir' }),
			);

			// Assert
			expect(mockSpawn).toHaveBeenCalledWith(
				['gh', 'cmd'],
				expect.objectContaining({ cwd: '/fallback/dir' }),
			);
		});
	});

	describe('error handling', () => {
		it('{execute} subprocess crash with signal code → returns combined output', async () => {
			// Arrange — exit code 139 = 128 + SIGSEGV (11), a real-world crash scenario.
			setupAppConfig('CRASH', mockFsReadFile);
			mockAuth.mockResolvedValue({
				token: 'ghs_crash',
				expiresAt: '2099-01-01T00:00:00Z',
			});
			mockSpawn.mockReturnValue(
				makeMockSubprocess({ stdout: 'partial', stderr: 'segmentation fault', exitCode: 139, signalCode: 'SIGSEGV' }),
			);

			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Act
			const result = await plugin.tool!['gh-crash'].execute(
				{ ghArgs: 'cmd' },
				makeToolContext(),
			);

			// Assert — error format must match: "Error executing {name}: gh command failed with exit code {code}: {stdout}\n{stderr}"
			expect(result).toBe('Error executing gh-crash: gh command failed with exit code 139: partial\nsegmentation fault');
			expect(mockSpawn).toHaveBeenCalledWith(
				['gh', 'cmd'],
				expect.objectContaining({ env: expect.objectContaining({ GH_TOKEN: 'ghs_crash' }) }),
			);
		});

		it('{execute} auth failure during token retrieval → returns error message', async () => {
			// Arrange
			setupAppConfig('AUTHTOKEN', mockFsReadFile);
			mockAuth.mockImplementation(() => {
				return Promise.reject(new Error('auth failure: token expired'));
			});
			mockSpawn.mockReturnValue(makeMockSubprocess({ stdout: 'ok' }));

			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Act
			const result = await plugin.tool!['gh-authtoken'].execute(
				{ ghArgs: 'cmd' },
				makeToolContext(),
			);

			// Assert
			expect(result).toBe('Error executing gh-authtoken: Command execution failed');
		});
	});
});
