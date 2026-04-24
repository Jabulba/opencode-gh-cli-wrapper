import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { getExecWithToken } from '../../src/tool-executor';
import { makeMockSubprocess } from '../test-utils/subprocess-mock';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockSpawn = vi.fn();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getExecWithToken', () => {
	let execWithToken: (token: string) => Promise<string>;
	const argsArray = ['repo', 'list'];
	const cwd = '/tmp';
	const baseEnv = { HOME: '/home/user' };
	const timeoutMs = 30000;
	const toolName = 'gh-test';

	beforeEach(() => {
		mockSpawn.mockClear();
		(Bun as any).spawn = mockSpawn;
		execWithToken = getExecWithToken(argsArray, cwd, baseEnv, timeoutMs, toolName);
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it('{getExecWithToken} exit code 0 → returns stdout', async () => {
		// Arrange
		mockSpawn.mockReturnValue(makeMockSubprocess({ stdout: 'success-output' }));

		// Act
		const result = await execWithToken('ghs_token');

		// Assert
		expect(result).toBe('success-output');
		expect(mockSpawn).toHaveBeenCalledWith(
			['gh', 'repo', 'list'],
			expect.objectContaining({
				cwd: '/tmp',
				env: expect.objectContaining({ GH_TOKEN: 'ghs_token', HOME: '/home/user' }),
				timeout: 30000,
			}),
		);
	});

	it('{getExecWithToken} non-zero exit code → throws ToolError',  () => {
		// Arrange
		mockSpawn.mockReturnValue(makeMockSubprocess({
			stdout: 'partial output',
			stderr: 'error message',
			exitCode: 1,
		}));

		// Act & Assert
		expect(execWithToken('ghs_token')).rejects.toThrow(/gh command failed with exit code 1/);
	});

	it('{getExecWithToken} empty stdout and stderr with non-zero exit → throws ToolError', () => {
		// Arrange
		mockSpawn.mockReturnValue(makeMockSubprocess({
			stdout: '',
			stderr: '',
			exitCode: 2,
		}));

		// Act & Assert
		expect(execWithToken('ghs_token')).rejects.toThrow(/gh command failed with exit code 2/);
	});

	it('{getExecWithToken} SIGTERM with non-zero exit → throws ToolError', () => {
		// Arrange — SIGTERM + non-zero exit = timeout (Bun kills on timeout).
		mockSpawn.mockReturnValue(makeMockSubprocess({
			exitCode: 1,
			signalCode: 'SIGTERM',
		}));

		// Act & Assert
		expect(execWithToken('ghs_token')).rejects.toThrow(/timed out after 30s/);
	});

	it('{getExecWithToken} SIGTERM with exit code 0 → returns stdout', async () => {
		// Arrange — SIGTERM with exit code 0 means the process completed cleanly
		// before the timeout threshold was hit; the signal code alone doesn't indicate failure.
		mockSpawn.mockReturnValue(makeMockSubprocess({
			stdout: 'clean exit',
			exitCode: 0,
			signalCode: 'SIGTERM',
		}));

		// Act
		const result = await execWithToken('ghs_token');

		// Assert
		expect(result).toBe('clean exit');
	});

	it('{getExecWithToken} other signal code with non-zero exit → throws ToolError', () => {
		// Arrange
		mockSpawn.mockReturnValue(makeMockSubprocess({
			stdout: 'partial',
			stderr: 'sigsegv',
			exitCode: 139,
			signalCode: 'SIGSEGV',
		}));

		// Act & Assert
		expect(execWithToken('ghs_token')).rejects.toThrow(/gh command failed with exit code 139/);
	});

	it('{getExecWithToken} passes token as GH_TOKEN env var', async () => {
		// Arrange
		mockSpawn.mockReturnValue(makeMockSubprocess({ stdout: 'ok' }));

		// Act
		await execWithToken('ghs_secret-token');

		// Assert
		expect(mockSpawn).toHaveBeenCalledWith(
			['gh', 'repo', 'list'],
			expect.objectContaining({
				env: expect.objectContaining({ GH_TOKEN: 'ghs_secret-token' }),
			}),
		);
	});
});
