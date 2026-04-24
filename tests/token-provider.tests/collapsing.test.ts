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

describe('TokenProvider Request Collapsing', () => {
	beforeEach(() => {
		resetTokenProviderMocks(mockReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth);
	});

	afterEach(() => {
		cleanupEnv();
		vi.resetAllMocks();
	});

	it('{getInstallationToken} concurrent calls for same key → share one auth request', async () => {
		// Arrange
		let authCallCount = 0;
		mockAuth.mockImplementation(async () => {
			authCallCount++;
			// 50ms delay forces both calls to overlap so request collapsing actually kicks in.
			await new Promise((r) => setTimeout(r, 50));
			return {
				token: `ghs_collapsed-${authCallCount}`,
				expiresAt: '2099-01-01T00:00:00Z',
			};
		});
		mockGetInstallationOctokit.mockResolvedValue({ auth: mockAuth });
		mockAppCtor.mockReturnValue({ getInstallationOctokit: mockGetInstallationOctokit });
		mockReadFile.mockResolvedValue(FAKE_PEM);

		const provider = new TokenProvider();

		// Act — Promise.all fires both calls simultaneously; collapsing ensures only one auth request runs.
		const [token1, token2] = await Promise.all([
			callGetInstallationToken(provider),
			callGetInstallationToken(provider),
		]);

		// Assert — both callers get the same token because they shared the single in-flight promise.
		expect(token1).toBe('ghs_collapsed-1');
		expect(token2).toBe('ghs_collapsed-1');
		expect(authCallCount).toBe(1);
		expect(mockAppCtor).toHaveBeenCalledTimes(1);
	});

	it('{getInstallationToken} concurrent calls for different keys → do NOT collapse', async () => {
		// Arrange
		let authCallCount = 0;
		mockAuth.mockImplementation(async () => {
			authCallCount++;
			await new Promise((r) => setTimeout(r, 50));
			return {
				token: 'ghs_token',
				expiresAt: '2099-01-01T00:00:00Z',
			};
		});
		mockGetInstallationOctokit.mockResolvedValue({ auth: mockAuth });
		mockAppCtor.mockReturnValue({ getInstallationOctokit: mockGetInstallationOctokit });
		mockReadFile.mockResolvedValue(FAKE_PEM);

		const provider = new TokenProvider();

		// Act
		const [tokenA, tokenB] = await Promise.all([
			callGetInstallationToken(provider, 'app-a', 111),
			callGetInstallationToken(provider, 'app-b', 222),
		]);

		// Assert
		expect(tokenA).toBe('ghs_token');
		expect(tokenB).toBe('ghs_token');
		expect(authCallCount).toBe(2);
		expect(mockAppCtor).toHaveBeenCalledTimes(2);
	});

	it('{getInstallationToken} in-flight failure → rejects all waiting callers', () => {
		// Arrange
		const testError = new Error('octokit-auth-failed');

		mockAuth.mockRejectedValue(testError);
		mockGetInstallationOctokit.mockResolvedValue({ auth: mockAuth });
		mockAppCtor.mockReturnValue({ getInstallationOctokit: mockGetInstallationOctokit });
		mockReadFile.mockResolvedValue(FAKE_PEM);

		const provider = new TokenProvider();

		// Act
		const p1 = callGetInstallationToken(provider);
		const p2 = callGetInstallationToken(provider);

		// p1 and p2 resolve to the SAME promise object (request collapsing).
		// p2 must be caught here to prevent an unhandled rejection from the shared error.
		p2.catch(() => {});

		expect(p1).rejects.toThrow(testError);

		// Verify shared-error invariant: only one auth call ran, error propagated to all waiters.
		expect(mockAuth).toHaveBeenCalledTimes(1);
	});
});
