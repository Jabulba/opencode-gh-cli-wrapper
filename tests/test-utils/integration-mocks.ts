import { vi } from 'bun:test';

/**
 * Creates a mock tool function that mimics the real @opencode-ai/plugin tool() API.
 * The returned function is a vi.fn() that accepts a tool definition and returns
 * an object with description, args, and execute properties, plus a schema property.
 */
export function createMockTool(): ReturnType<typeof vi.fn> {
	const executeFn: any = vi.fn().mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
	const toolFn: any = vi.fn((def: any) => {
		return {
			description: def.description,
			args: def.args,
			execute: def.execute || executeFn,
		};
	});
	toolFn.schema = {
		string: () => ({ describe: (_d: string) => ({}) }),
	};
	return toolFn;
}

/**
 * Creates fresh mock functions for integration tests.
 * Each test file should call this in its file scope.
 */
export function createIntegrationMocks() {
	const mockFsReadFile = vi.fn();
	const mockAppCtor = vi.fn();
	const mockGetInstallationOctokit = vi.fn();
	const mockAuth = vi.fn();
	const mockSpawn = vi.fn();

	return { mockFsReadFile, mockAppCtor, mockGetInstallationOctokit, mockAuth, mockSpawn };
}

/**
 * Clears all integration mock state and restores default mock chains.
 * Call this in beforeEach after vi.resetAllMocks() has been called in afterEach.
 * mockSpawn is optional — some tests (e.g., errors.integration.test.ts) don't use it.
 */
export function resetIntegrationMocks(
	mockFsReadFile: ReturnType<typeof vi.fn>,
	mockAppCtor: ReturnType<typeof vi.fn>,
	mockGetInstallationOctokit: ReturnType<typeof vi.fn>,
	mockAuth: ReturnType<typeof vi.fn>,
	mockSpawn?: ReturnType<typeof vi.fn>,
): void {
	mockFsReadFile.mockClear();
	mockAppCtor.mockClear();
	mockGetInstallationOctokit.mockClear();
	mockAuth.mockClear();
	mockSpawn?.mockClear();

	// Restore default mock chains that are needed for octokit flow.
	// These must be set AFTER mockClear() because vi.resetAllMocks() in afterEach
	// would have wiped them. Using mockImplementation so the chain persists.
	mockGetInstallationOctokit.mockImplementation(() => Promise.resolve({ auth: mockAuth }));
	mockAppCtor.mockImplementation(() => ({ getInstallationOctokit: mockGetInstallationOctokit }));
}
