import type { PluginInput, ToolContext } from '@opencode-ai/plugin';
import { vi } from 'bun:test';

/**
 * Creates a default PluginInput with standard test values.
 * Overrides can be passed to customize specific fields.
 */
export function makePluginInput(overrides: Partial<PluginInput> = {}): PluginInput {
	return {
		client: {} as any,
		project: { id: 'test', name: 'test', directory: '/tmp' } as any,
		directory: '/tmp',
		worktree: '/tmp',
		experimental_workspace: { register: vi.fn() } as any,
		serverUrl: new URL('http://localhost'),
		$: {} as any,
		...overrides,
	};
}

/**
 * Creates a default ToolContext with standard test values.
 * Overrides can be passed to customize specific fields.
 */
export function makeToolContext(overrides: Partial<ToolContext> = {}): ToolContext {
	return {
		sessionID: 'test-session',
		messageID: 'test-message',
		agent: 'test-agent',
		directory: '/tmp',
		worktree: '/tmp',
		abort: new AbortController().signal,
		metadata: vi.fn(),
		ask: vi.fn(),
		...overrides,
	};
}

/**
 * Creates a ToolContext with sensible test defaults.
 */
export function makeTestToolContext(overrides?: Partial<ToolContext>): ToolContext {
	return makeToolContext({ worktree: '/tmp', ...overrides });
}
