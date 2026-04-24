import { vi } from 'bun:test';
import { createMockTool } from './integration-mocks';

/**
 * Sets up vi.mock() declarations for main.integration.test.ts files.
 * Call this at module scope, before any imports of the source modules.
 *
 * Replaces the following boilerplate in each test file:
 *   void vi.mock('@opencode-ai/plugin', () => ({ tool: createMockTool() }));
 *   void vi.mock('fs', () => ({ promises: { readFile: mockFsReadFile } }));
 *   void vi.mock('octokit', () => ({ App: mockAppCtor }));
 */
export function setupMainModuleMocks({
	mockFsReadFile,
	mockAppCtor,
}: {
	mockFsReadFile: ReturnType<typeof vi.fn>;
	mockAppCtor: ReturnType<typeof vi.fn>;
}): void {
	void vi.mock('@opencode-ai/plugin', () => ({
		tool: createMockTool(),
	}));

	void vi.mock('fs', () => ({
		promises: { readFile: mockFsReadFile },
	}));

	void vi.mock('octokit', () => ({ App: mockAppCtor }));
}

/**
 * Sets up vi.mock() declarations for token-provider.test.ts files.
 * Call this at module scope, before any imports of the source modules.
 *
 * Replaces the following boilerplate in each test file:
 *   void vi.mock('fs', () => ({ promises: { readFile: mockReadFile } }));
 *   void vi.mock('octokit', () => ({ App: mockAppCtor }));
 */
export function setupTokenProviderModuleMocks({
	mockReadFile,
	mockAppCtor,
}: {
	mockReadFile: ReturnType<typeof vi.fn>;
	mockAppCtor: ReturnType<typeof vi.fn>;
}): void {
	void vi.mock('fs', () => ({
		promises: { readFile: mockReadFile },
	}));

	void vi.mock('octokit', () => ({ App: mockAppCtor }));
}
