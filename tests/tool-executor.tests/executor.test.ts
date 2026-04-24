import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { getToolExecutor } from '../../src/tool-executor';
import { TokenProvider } from '../../src/token-provider';
import type { ToolContext } from '@opencode-ai/plugin';
import { makeMockSubprocess } from '../test-utils/subprocess-mock';
import { makeTestToolContext } from '../test-utils/context-factories';

// ---------------------------------------------------------------------------
// Mock functions
// ---------------------------------------------------------------------------

const mockGetInstallationToken = vi.fn();
const mockInvalidate = vi.fn();

void vi.mock('../../src/token-provider', () => ({
	TokenProvider: vi.fn(() => ({
		getInstallationToken: mockGetInstallationToken,
		invalidate: mockInvalidate,
	})),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getToolExecutor', () => {
	let toolCtx: ToolContext;
	let mockTokenProvider: TokenProvider;

	beforeEach(() => {
		mockGetInstallationToken.mockClear();
		mockInvalidate.mockClear();
		toolCtx = makeTestToolContext({ sessionID: 'test-session', messageID: 'test-message', agent: 'test-agent', directory: '/tmp/dir', });
		mockTokenProvider = new TokenProvider();
		// Mock Bun.spawn so getExecWithToken does not actually spawn a process
		(Bun as any).spawn = vi.fn(() => makeMockSubprocess());
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it('{getToolExecutor} returns async function → passes ghArgs to splitShellArgs', async () => {
		// Arrange
		mockGetInstallationToken.mockResolvedValue('ghs_fake-token');

		const executor = getToolExecutor('gh-myapp', 30000, mockTokenProvider, '123', 456, '/key.pem');

		// Act
		await executor({ ghArgs: 'repo list' }, toolCtx);

		// Assert — verify splitShellArgs was called by checking Bun.spawn args
		expect((Bun as any).spawn).toHaveBeenCalledWith(
			['gh', 'repo', 'list'],
			expect.any(Object),
		);
		expect(mockGetInstallationToken).toHaveBeenCalledWith('123', 456, '/key.pem');
	});

	it('{getToolExecutor} worktree set → uses worktree as cwd', async () => {
		// Arrange
		mockGetInstallationToken.mockResolvedValue('ghs_fake-token');
		const executor = getToolExecutor('gh-myapp', 30000, mockTokenProvider, '123', 456, '/key.pem');

		const ctxWithWorktree = {
			...toolCtx,
			worktree: '/custom/worktree',
			directory: '/tmp/dir',
		};

		// Act
		await executor({ ghArgs: 'cmd' }, ctxWithWorktree);

		// Assert — verify cwd is set to worktree
		expect(mockGetInstallationToken).toHaveBeenCalled();
		expect((Bun as any).spawn).toHaveBeenCalledWith(
			['gh', 'cmd'],
			expect.objectContaining({ cwd: '/custom/worktree' }),
		);
	});

	it('{getToolExecutor} worktree not set → falls back to directory', async () => {
		// Arrange
		mockGetInstallationToken.mockResolvedValue('ghs_fake-token');
		const executor = getToolExecutor('gh-myapp', 30000, mockTokenProvider, '123', 456, '/key.pem');

		const ctxNoWorktree = {
			...toolCtx,
			worktree: undefined as unknown as string,
			directory: '/fallback/dir',
		};

		// Act
		await executor({ ghArgs: 'cmd' }, ctxNoWorktree);

		// Assert
		expect(mockGetInstallationToken).toHaveBeenCalled();
		expect((Bun as any).spawn).toHaveBeenCalledWith(
			['gh', 'cmd'],
			expect.objectContaining({ cwd: '/fallback/dir' }),
		);
	});

	it('{getToolExecutor} both worktree and directory undefined → falls back to process.cwd()', async () => {
		// Arrange
		mockGetInstallationToken.mockResolvedValue('ghs_fake-token');
		const executor = getToolExecutor('gh-myapp', 30000, mockTokenProvider, '123', 456, '/key.pem');

		const ctxNoCwd = {
			...toolCtx,
			worktree: undefined as unknown as string,
			directory: undefined as unknown as string,
		};

		// Act
		await executor({ ghArgs: 'cmd' }, ctxNoCwd);

		// Assert
		expect(mockGetInstallationToken).toHaveBeenCalled();
		expect((Bun as any).spawn).toHaveBeenCalledWith(
			['gh', 'cmd'],
			expect.objectContaining({ cwd: process.cwd() }),
		);
	});

	it('{getToolExecutor} timeout_ms → captured in closure', async () => {
		// Arrange
		mockGetInstallationToken.mockResolvedValue('ghs_fake-token');
		const executor = getToolExecutor('gh-myapp', 5000, mockTokenProvider, '123', 456, '/key.pem');

		// Act
		await executor({ ghArgs: 'cmd' }, toolCtx);

		// Assert — verify timeout was captured in the spawn call
		expect(mockGetInstallationToken).toHaveBeenCalled();
		expect((Bun as any).spawn).toHaveBeenCalledWith(
			['gh', 'cmd'],
			expect.objectContaining({ timeout: 5000 }),
		);
	});

	it('{getToolExecutor} tokenProvider throws auth error → invalidates and retries', async () => {
		// Arrange — conditional mock: first call fails with 401, second call succeeds with fresh token.
		// This simulates the real flow: stale token → auth error → invalidate → re-mint → retry.
		let authCallCount = 0;
		mockGetInstallationToken.mockImplementation(async () => {
			authCallCount++;
			if (authCallCount === 1) {
				return Promise.reject(new Error('auth failure: 401 Unauthorized'));
			}
			return Promise.resolve('ghs_fresh-token');
		});

		const executor = getToolExecutor('gh-myapp', 30000, mockTokenProvider, '123', 456, '/key.pem');

		// Act
		const result = await executor({ ghArgs: 'cmd' }, toolCtx);

		// Assert — verify the full state transition: invalidate was called, auth ran twice,
		// and the second spawn used the fresh token (not the stale one).
		expect(mockInvalidate).toHaveBeenCalledWith('123', 456);
		expect(authCallCount).toBe(2);
		expect(result).toBe('ok');
		expect((Bun as any).spawn).toHaveBeenCalledWith(
			['gh', 'cmd'],
			expect.objectContaining({
				env: expect.objectContaining({ GH_TOKEN: 'ghs_fresh-token' }),
			}),
		);
	});

	it('{getToolExecutor} tokenProvider throws non-auth error → returns error message without retry', async () => {
		// Arrange
		const executor = getToolExecutor('gh-myapp', 30000, mockTokenProvider, '123', 456, '/key.pem');
		mockGetInstallationToken.mockRejectedValue(new Error('network timeout'));

		// Act
		const result = await executor({ ghArgs: 'cmd' }, toolCtx);

		// Assert
		expect(mockInvalidate).not.toHaveBeenCalled();
		expect(result).toBe('Error executing gh-myapp: Command execution failed');
	});
});
