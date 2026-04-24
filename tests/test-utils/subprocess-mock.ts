import { vi } from 'bun:test';

/**
 * Constructs a Bun subprocess mock.
 * new Response(body).body! creates a ReadableStream — Bun.spawn uses ReadableStream for stdout/stderr.
 */
export function makeMockSubprocess({
	stdout = 'ok',
	stderr = '',
	exitCode = 0,
	signalCode = null,
}: {
	stdout?: string;
	stderr?: string;
	exitCode?: number;
	signalCode?: string | null;
} = {}) {
	return {
		stdout: new Response(stdout).body!,
		stderr: new Response(stderr).body!,
		exited: Promise.resolve(exitCode),
		signalCode,
		terminate: vi.fn(),
	};
}
