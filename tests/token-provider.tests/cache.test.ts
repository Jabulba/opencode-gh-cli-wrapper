import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { TokenProvider } from '../../src/token-provider';
import { FAKE_PEM } from '../test-utils/constants';
import { cleanupEnv } from '../test-utils/env';
import { callGetInstallationToken, createTokenProviderMocks, resetTokenProviderMocks, setupTokenProviderMocks } from '../test-utils/token-provider';
import { setupTokenProviderModuleMocks } from '../test-utils/module-mocks';

// ---------------------------------------------------------------------------
// Mocks — file-scoped, per-test-file instances
// ---------------------------------------------------------------------------

const { mockReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth } = createTokenProviderMocks();

setupTokenProviderModuleMocks({ mockReadFile, mockAppCtor });

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUFFER_WINDOW_MS = 120_000;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TokenProvider Cache', () => {
	beforeEach(() => {
		resetTokenProviderMocks(mockReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth);
	});

	afterEach(() => {
		cleanupEnv();
		vi.resetAllMocks();
	});

	describe('token cache', () => {
		it('{getInstallationToken} cache miss → mints and caches token', async () => {
			// Arrange
			setupTokenProviderMocks(mockReadFile, mockAuth, mockGetInstallationOctokit, mockAppCtor, 'ghs_minted-token');
			const provider = new TokenProvider();

			// Act
			const token = await callGetInstallationToken(provider);

			// Assert
			expect(token).toBe('ghs_minted-token');
			expect(mockAppCtor).toHaveBeenCalledTimes(1);
		});

		it('{getInstallationToken} cache hit → returns cached token without re-minting', async () => {
			// Arrange
			setupTokenProviderMocks(mockReadFile, mockAuth, mockGetInstallationOctokit, mockAppCtor, 'ghs_cached-token');
			const provider = new TokenProvider();

			// Act
			const token1 = await callGetInstallationToken(provider);
			const token2 = await callGetInstallationToken(provider);

			// Assert
			expect(token1).toBe('ghs_cached-token');
			expect(token2).toBe('ghs_cached-token');
			expect(mockAppCtor).toHaveBeenCalledTimes(1);
		});
	});

	describe('cache expiration', () => {
		it('{getInstallationToken} expired token → triggers refresh', async () => {
			// Arrange
			let authCallCount = 0;
			const token1 = 'ghs_expired-1';
			const token2 = 'ghs_expired-2';
			const pastDate = new Date(Date.now() - 60_000).toISOString();

			mockAuth.mockImplementation(() => {
				authCallCount++;
				return {
					token: authCallCount === 1 ? token1 : token2,
					expiresAt: pastDate,
				};
			});
			mockGetInstallationOctokit.mockResolvedValue({ auth: mockAuth });
			mockAppCtor.mockReturnValue({ getInstallationOctokit: mockGetInstallationOctokit });
			mockReadFile.mockResolvedValue(FAKE_PEM);

			const provider = new TokenProvider();

			// Act
			const result1 = await callGetInstallationToken(provider);
			const result2 = await callGetInstallationToken(provider);

			// Assert
			expect(result1).toBe(token1);
			expect(result2).toBe(token2);
			expect(mockAppCtor).toHaveBeenCalledTimes(1);
		});

		it.each([
			// Token expires within 2-min buffer → first call caches it, second call sees it's too close to expiry and re-mints.
			['within 2-minute buffer', BUFFER_WINDOW_MS - 30_000, 2],
			// Token expires outside buffer → first call caches it, second call returns cached (no re-mint).
			['outside 2-minute buffer', BUFFER_WINDOW_MS + 30_000, 1],
		])('{getInstallationToken} token %s → auth called %d time(s)', async (_label, timeOffsetMs, expectedAuthCalls) => {
			// Arrange — the 2-minute buffer proactively refreshes tokens before they expire to avoid
			// race conditions where a token expires mid-request between the cache check and the gh call.
			const token = 'ghs-buffer-token';
			const expiresAt = new Date(Date.now() + timeOffsetMs).toISOString();

			mockAuth.mockResolvedValue({ token, expiresAt });
			mockGetInstallationOctokit.mockResolvedValue({ auth: mockAuth });
			mockAppCtor.mockReturnValue({ getInstallationOctokit: mockGetInstallationOctokit });
			mockReadFile.mockResolvedValue(FAKE_PEM);

			const provider = new TokenProvider();

			// Act — two sequential calls: second call either hits cache or triggers early refresh.
			const result1 = await callGetInstallationToken(provider);
			const result2 = await callGetInstallationToken(provider);

			// Assert
			expect(result1).toBe(token);
			expect(result2).toBe(token);
			expect(mockAppCtor).toHaveBeenCalledTimes(1);
			expect(mockAuth).toHaveBeenCalledTimes(expectedAuthCalls);
		});
	});
});
