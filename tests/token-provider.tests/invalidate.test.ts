import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { TokenProvider } from '../../src/token-provider';
import { FAKE_PEM } from '../test-utils/constants';
import { cleanupEnv } from '../test-utils/env';
import { callGetInstallationToken, createTokenProviderMocks, resetTokenProviderMocks } from '../test-utils/token-provider';
import { setupTokenProviderModuleMocks } from '../test-utils/module-mocks';

// ---------------------------------------------------------------------------
// Mocks — file-scoped, per-test-file instances
// ---------------------------------------------------------------------------

const { mockReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth } = createTokenProviderMocks();

setupTokenProviderModuleMocks({ mockReadFile, mockAppCtor });

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TokenProvider Invalidation', () => {
	beforeEach(() => {
		resetTokenProviderMocks(mockReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth);
	});

	afterEach(() => {
		cleanupEnv();
		vi.resetAllMocks();
	});

	it('{invalidate} valid key → removes cached token', async () => {
		// Arrange
		mockReadFile.mockResolvedValue(FAKE_PEM);
		mockAuth.mockResolvedValue({ token: 'ghs-before-invalidate', expiresAt: '2099-01-01T00:00:00Z' });
		mockGetInstallationOctokit.mockResolvedValue({ auth: mockAuth });
		mockAppCtor.mockReturnValue({ getInstallationOctokit: mockGetInstallationOctokit });
		const provider = new TokenProvider();

		// Act — three-step sequence: (1) get token1 (cached), (2) invalidate, (3) get token2.
		// The mockAuth update on line 71 must happen between invalidate and the second get
		// to simulate a fresh auth response — otherwise the old mock would return the stale token.
		const token1 = await callGetInstallationToken(provider);
		provider.invalidate('123', 456);

		mockAuth.mockResolvedValue({ token: 'ghs-after-invalidate', expiresAt: '2099-01-01T00:00:00Z' });
		const token2 = await callGetInstallationToken(provider);

		// Assert — token2 differs from token1 (cache was invalidated), but mockAppCtor called
		// only once because the Octokit App instance is cached separately from the token.
		expect(token1).toBe('ghs-before-invalidate');
		expect(token2).toBe('ghs-after-invalidate');
		expect(mockAppCtor).toHaveBeenCalledTimes(1);
	});

	it('{invalidate} non-existent key → no-op', () => {
		// Arrange
		const provider = new TokenProvider();

		// Act & Assert
		expect(() => provider.invalidate('999', 888)).not.toThrow();
	});
});
