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

const { mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth } = createIntegrationMocks();

setupMainModuleMocks({ mockFsReadFile, mockAppCtor });

// ---------------------------------------------------------------------------
// Source imports
// ---------------------------------------------------------------------------

import { GitHubCLIWrapper } from '../../src/main';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GitHubCLIWrapper errors', () => {
	beforeEach(() => {
		resetIntegrationMocks(mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth);
	});

	afterEach(() => {
		cleanupEnv();
		vi.resetAllMocks();
	});

	it('{GitHubCLIWrapper} missing env vars for configured app → throws error', () => {
		// Arrange
		mockFsReadFile.mockResolvedValue(JSON.stringify({
			apps: [{ name: 'no-env' }],
		}));
		// Deliberately NOT setting GH_APP_ID_NO_ENV etc.

		// Act & Assert
		expect(GitHubCLIWrapper(makePluginInput())).rejects.toThrow(/Missing environment configuration for app: no-env/);
	});
});
