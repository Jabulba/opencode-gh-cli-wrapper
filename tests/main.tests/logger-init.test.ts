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
import { logger } from '../../src/logger';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GitHubCLIWrapper logger init', () => {
	beforeEach(() => {
		resetIntegrationMocks(mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth, mockSpawn);
		(Bun as any).spawn = mockSpawn;
	});

	afterEach(() => {
		cleanupEnv();
		vi.resetAllMocks();
	});

	it('{GitHubCLIWrapper} client.app.log exists → calls logger.init', async () => {
		// Arrange
		const mockClientLog = vi.fn().mockResolvedValue(undefined);
		process.env[`GH_APP_ID_LOGGER`] = '1';
		process.env[`GH_INSTALL_ID_LOGGER`] = '1';
		process.env[`GH_PEM_PATH_LOGGER`] = '/key.pem';
		mockFsReadFile.mockResolvedValue(JSON.stringify({
			apps: [{ name: 'logger' }],
		}));

		const initSpy = vi.spyOn(logger, 'init');

		// Act
		await GitHubCLIWrapper(makePluginInput({
			client: { app: { log: mockClientLog } } as any,
		}));

		// Assert
		expect(initSpy).toHaveBeenCalledTimes(1);
		expect(typeof (initSpy.mock.calls[0]![0])).toBe('function');

		initSpy.mockRestore();
	});

	it('{GitHubCLIWrapper} client.app.log undefined → does not call logger.init', async () => {
		// Arrange
		process.env[`GH_APP_ID_NLOGGER`] = '1';
		process.env[`GH_INSTALL_ID_NLOGGER`] = '1';
		process.env[`GH_PEM_PATH_NLOGGER`] = '/key.pem';
		mockFsReadFile.mockResolvedValue(JSON.stringify({
			apps: [{ name: 'nlogger' }],
		}));

		const initSpy = vi.spyOn(logger, 'init');

		// Act
		await GitHubCLIWrapper(makePluginInput({
			client: {} as any,
		}));

		// Assert
		expect(initSpy).not.toHaveBeenCalled();

		initSpy.mockRestore();
	});
});
