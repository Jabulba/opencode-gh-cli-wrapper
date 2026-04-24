import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';

// ---------------------------------------------------------------------------
// Shared mock utilities — imported at top so functions are in scope for vi.mock()
// ---------------------------------------------------------------------------

import { createIntegrationMocks, resetIntegrationMocks } from '../test-utils/integration-mocks';
import { makeMockSubprocess } from '../test-utils/subprocess-mock';
import { makePluginInput, makeToolContext } from '../test-utils/context-factories';
import { cleanupEnv } from '../test-utils/env';
import { setupMainModuleMocks } from '../test-utils/module-mocks';
import { setupAppConfig } from '../test-utils/integration-setup';

// ---------------------------------------------------------------------------
// Mocks — file-scoped, per-test-file instances
// ---------------------------------------------------------------------------

const { mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth, mockSpawn } = createIntegrationMocks();

setupMainModuleMocks({ mockFsReadFile, mockAppCtor });

import { TokenProvider } from '../../src/token-provider';
import { GitHubCLIWrapper } from '../../src/main';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GitHubCLIWrapper authentication', () => {
	beforeEach(() => {
		resetIntegrationMocks(mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth, mockSpawn);
		(Bun as any).spawn = mockSpawn;
	});

	afterEach(() => {
		cleanupEnv();
		vi.resetAllMocks();
	});

	describe('auth failure retry', () => {
		it('{execute} retry auth failure → falls through to error handling', async () => {
			// Arrange — subprocess-level 401 (gh CLI returns it in stderr).
			// This should NOT trigger token invalidation or retry; the error propagates directly.
			setupAppConfig('AUTHFAIL', mockFsReadFile);
			mockAuth.mockResolvedValue({
				token: 'ghs_old',
				expiresAt: '2099-01-01T00:00:00Z',
			});

			let spawnCallCount = 0;
			mockSpawn.mockImplementation(() => {
				spawnCallCount++;
				return makeMockSubprocess({
					stdout: '',
					stderr: 'HTTP 401: Authentication failed',
					exitCode: 1,
				});
			});

			// Spy on TokenProvider.invalidate to confirm it is NOT called for subprocess-level 401.
			const invalidateSpy = vi.spyOn(TokenProvider.prototype, 'invalidate');
			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Act
			const result = await plugin.tool!['gh-authfail'].execute(
				{ ghArgs: 'cmd' },
				makeToolContext(),
			);

			// Assert — ToolError caught before auth retry; single spawn attempt, no invalidation.
			expect(result).toBe('Error executing gh-authfail: gh command failed with exit code 1: HTTP 401: Authentication failed');
			expect(spawnCallCount).toBe(1);
			expect(invalidateSpy).not.toHaveBeenCalled();
		});

		it('{execute} retry auth failure → ToolError on retry returns error message', async () => {
			// Arrange — token-level 401 (Octokit rejects during mint).
			// This triggers: invalidate → re-mint → retry spawn → SIGTERM timeout.
			// The final result is the timeout error, not the auth error.
			setupAppConfig('TOOLERR', mockFsReadFile);

			let authCallCount = 0;
			mockAuth.mockImplementation(async () => {
				authCallCount++;
				if (authCallCount === 1) {
					return Promise.reject(new Error('auth failure: 401 Unauthorized'));
				}
				return Promise.resolve({
					token: 'ghs_fresh',
					expiresAt: '2099-01-01T00:00:00Z',
				});
			});

			mockSpawn.mockReturnValue(makeMockSubprocess({
				stdout: '',
				stderr: '',
				exitCode: 1,
				signalCode: 'SIGTERM',
			}));

			// Spy on invalidate to confirm token-level 401 triggers invalidation.
			const invalidateSpy = vi.spyOn(TokenProvider.prototype, 'invalidate');
			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Act
			const result = await plugin.tool!['gh-toolerr'].execute(
				{ ghArgs: 'cmd' },
				makeToolContext(),
			);

			// Assert — invalidate was called (token-level auth failure), final result is timeout error.
			expect(invalidateSpy).toHaveBeenCalled();
			expect(result).toBe('Error executing gh-toolerr: Command timed out after 60s');
		});
	});

	describe('successful authentication', () => {
		it('{execute} happy path → returns stdout on success', async () => {
			// Arrange
			setupAppConfig('SUCCESS', mockFsReadFile);
			mockAuth.mockResolvedValue({
				token: 'ghs_valid',
				expiresAt: '2099-01-01T00:00:00Z',
			});
			mockSpawn.mockReturnValue(makeMockSubprocess({
				stdout: 'success-output',
				stderr: '',
				exitCode: 0,
			}));

			const plugin = await GitHubCLIWrapper(makePluginInput());

			// Act
			const result = await plugin.tool!['gh-success'].execute(
				{ ghArgs: 'cmd' },
				makeToolContext(),
			);

			// Assert
			expect(result).toBe('success-output');
			expect(mockSpawn).toHaveBeenCalledWith(['gh', 'cmd'], expect.objectContaining({
				env: expect.objectContaining({ GH_TOKEN: 'ghs_valid' }),
			}));
		});
	});
});
