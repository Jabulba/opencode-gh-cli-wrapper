import { vi } from 'bun:test';
import type { TokenProvider } from '../../src/token-provider';
import { FAKE_PEM } from './constants';

/**
 * Calls getInstallationToken with default arguments.
 */
export async function callGetInstallationToken(
	provider: TokenProvider,
	appId = '123',
	installId = 456,
	pemPath = '/fake/path.pem',
): Promise<string> {
	return await provider.getInstallationToken(appId, installId, pemPath);
}

/**
 * Creates fresh mock functions for TokenProvider tests.
 * Each test file should call this in its file scope to get its own mock instances.
 */
export function createTokenProviderMocks() {
	const mockReadFile = vi.fn();
	const mockAppCtor = vi.fn();
	const mockGetInstallationOctokit = vi.fn();
	const mockAuth = vi.fn();

	return { mockReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth };
}

/**
 * Configures token provider mocks with the given token and expiration.
 * Call this in test setup (before calling provider.getInstallationToken()).
 */
export function setupTokenProviderMocks(
	mockReadFile: ReturnType<typeof vi.fn>,
	mockAuth: ReturnType<typeof vi.fn>,
	mockGetInstallationOctokit: ReturnType<typeof vi.fn>,
	mockAppCtor: ReturnType<typeof vi.fn>,
	token: string,
	expiresAt: string = '2099-01-01T00:00:00Z',
): void {
	mockReadFile.mockResolvedValue(FAKE_PEM);
	mockAuth.mockResolvedValue({
		token,
		expiresAt,
	});
	mockGetInstallationOctokit.mockResolvedValue({ auth: mockAuth });
	mockAppCtor.mockReturnValue({ getInstallationOctokit: mockGetInstallationOctokit });
}

/**
 * Clears all token provider mock state.
 * Call this in beforeEach.
 */
export function resetTokenProviderMocks(
	mockReadFile: ReturnType<typeof vi.fn>,
	mockAppCtor: ReturnType<typeof vi.fn>,
	mockGetInstallationOctokit: ReturnType<typeof vi.fn>,
	mockAuth: ReturnType<typeof vi.fn>,
): void {
	mockReadFile.mockClear();
	mockAppCtor.mockClear();
	mockGetInstallationOctokit.mockClear();
	mockAuth.mockClear();
}
