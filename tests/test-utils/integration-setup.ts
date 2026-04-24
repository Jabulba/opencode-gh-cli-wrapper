import { vi } from 'bun:test';
import { setupAppEnv } from './env';

/**
 * Replaces the common three-line pattern in integration tests:
 *   setupAppEnv('SUFFIX');
 *   mockFsReadFile.mockResolvedValue(JSON.stringify({ apps: [{ name: 'suffix' }] }));
 *   mockAuth.mockResolvedValue({ token: 'ghs_...', expiresAt: '...' });
 *
 * Note: This helper handles only the first two lines. The mockAuth.mockResolvedValue
 * call remains in the test because the token value varies per test.
 */
export function setupAppConfig(
	suffix: string,
	mockFsReadFile: ReturnType<typeof vi.fn>,
): void {
	setupAppEnv(suffix);
	mockFsReadFile.mockResolvedValue(JSON.stringify({ apps: [{ name: suffix.toLowerCase() }] }));
}
