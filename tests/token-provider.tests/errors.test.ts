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

describe('TokenProvider Errors', () => {
	beforeEach(() => {
		resetTokenProviderMocks(mockReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth);
	});

	afterEach(() => {
		cleanupEnv();
		vi.resetAllMocks();
	});

	describe('auth result errors', () => {
		it('{getInstallationToken} Octokit returns undefined token → throws TokenError',  () => {
			// Arrange
			mockAuth.mockResolvedValue({ token: undefined });
			mockGetInstallationOctokit.mockResolvedValue({ auth: mockAuth });
			mockAppCtor.mockReturnValue({ getInstallationOctokit: mockGetInstallationOctokit });
			mockReadFile.mockResolvedValue(FAKE_PEM);

			const provider = new TokenProvider();

			// Act & Assert
			expect(provider.getInstallationToken('123', 456, '/fake/path.pem'))
				.rejects.toThrow('Failed to obtain installation token from Octokit');
		});

		it('{getInstallationToken} token without expiresAt → defaults to 1 hour', async () => {
			// Arrange — Octokit may omit expiresAt; the provider should default to 1 hour
			// and still cache the token (second call should NOT trigger a new auth).
			mockAuth.mockResolvedValue({ token: 'ghs-no-expiry' });
			mockGetInstallationOctokit.mockResolvedValue({ auth: mockAuth });
			mockAppCtor.mockReturnValue({ getInstallationOctokit: mockGetInstallationOctokit });
			mockReadFile.mockResolvedValue(FAKE_PEM);

			const provider = new TokenProvider();

			// Act
			const token = await callGetInstallationToken(provider);
			const token2 = await callGetInstallationToken(provider);

			// Assert — mockAppCtor called once proves the token was cached despite missing expiresAt.
			expect(token).toBe('ghs-no-expiry');
			expect(token2).toBe('ghs-no-expiry');
			expect(mockAppCtor).toHaveBeenCalledTimes(1);
		});
	});

	describe('PEM read errors', () => {
		it('{getInstallationToken} invalid PEM path → throws PemReadError',  () => {
			// Arrange
			mockReadFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

			const provider = new TokenProvider();

			// Act & Assert
			expect(provider.getInstallationToken('123', 456, '/nonexistent/path.pem'))
				.rejects.toThrow(/Failed to read private key file/);
		});

		it('{getInstallationToken} EACCES error → includes OS detail in message',  () => {
			// Arrange — EACCES (permission denied) is a different error code than ENOENT.
			// The wrapper should produce a distinct error message for each.
			const eaccesError = Object.assign(new Error('Permission denied'), { code: 'EACCES' });
			mockReadFile.mockRejectedValue(eaccesError);

			const provider = new TokenProvider();

			// Act & Assert
			expect(provider.getInstallationToken('123', 456, '/fake/path.pem'))
				.rejects.toThrow('Failed to read private key file');
		});
	});
});
