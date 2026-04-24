// Copyright (c) 2026 Jabulba. MIT License.
import {TokenProvider} from "./token-provider";
import {splitShellArgs} from "./utils";
import {ToolError} from "./errors";
import type {ToolContext, ToolResult} from "@opencode-ai/plugin";

/** Regex matching 401/403 patterns in error messages (HTTP auth failure indicators). */
const AUTH_FAILURE_CODES = /\b(401|403)\b/;

/**
 * Creates a tool executor function that runs the `gh` CLI with authentication.
 * The executor splits shell arguments, spawns the `gh` subprocess with a fresh
 * installation token, and handles timeouts and auth failures (401/403) with
 * automatic retry.
 *
 * @param toolName - Name of the tool (used in error messages)
 * @param timeoutMs - Timeout in milliseconds for the subprocess
 * @param tokenProvider - Provider for GitHub installation tokens
 * @param appId - GitHub App ID
 * @param installId - GitHub App installation ID
 * @param pemPath - Path to the PEM private key
 * @returns An execute function compatible with the @opencode-ai/plugin tool interface
 */
export function getToolExecutor(
	toolName: string,
	timeoutMs: number,
	tokenProvider: TokenProvider,
	appId: string,
	installId: number,
	pemPath: string
) {
	return async (args: { ghArgs: string }, toolCtx: ToolContext): Promise<ToolResult> => {
		const argsArray = splitShellArgs(args.ghArgs);
		// Cast needed: process.env values are string | undefined, but we don't filter — gh inherits the full parent env.
		const baseEnv: Record<string, string> = Object.fromEntries(Object.entries(process.env) as [string, string][]);
		// Prefer worktree (per-agent Git dir) so gh operates in the correct repo context.
		const cwd = toolCtx.worktree || toolCtx.directory || process.cwd();
		const execWithToken = getExecWithToken(argsArray, cwd, baseEnv, timeoutMs, toolName);

		try {
			const token = await tokenProvider.getInstallationToken(appId, installId, pemPath);
			return await execWithToken(token);
		} catch (error: unknown) {
			// Timeout and other ToolErrors are formatted as user-readable messages
			if (error instanceof ToolError) {
				return `Error executing ${toolName}: ${error.message}`;
			}

			// Auth failure (401/403) triggers token refresh and retry
			const rawMessage = error instanceof Error ? error.message : String(error);
			// /auth/i catches textual mentions ("Authentication failed"); AUTH_FAILURE_CODES catches HTTP status numbers.
			const isAuthFailure = /auth/i.test(rawMessage) || AUTH_FAILURE_CODES.test(rawMessage);

			// If Auth failure: retry once with a freshly minted token.
			if (isAuthFailure) {
				tokenProvider.invalidate(appId, installId);
				try {
					// Note: retry only applies to cached token auth failures.
					const retryToken = await tokenProvider.getInstallationToken(appId, installId, pemPath);
					return await execWithToken(retryToken);
				} catch (retryError: unknown) {
					if (retryError instanceof ToolError) {
						return `Error executing ${toolName}: ${retryError.message}`;
					}
					return `Error executing ${toolName}: Command execution failed`;
				}
			}

			return `Error executing ${toolName}: Command execution failed`;
		}
	};
}

/**
 * Creates a factory function that executes a GitHub CLI command with the provided arguments and environment variables.
 * @param argsArray - Array of arguments to pass to the GitHub CLI command.
 * @param cwd - The current working directory for the subprocess execution.
 * @param baseEnv - Base environment variables to include in the subprocess environment.
 * @param timeoutMs - Timeout duration in milliseconds before the command is terminated.
 * @param toolName - Name of the tool used for error metadata.
 * @returns A function that accepts an authentication token and returns a Promise resolving to the command output.
 */
export function getExecWithToken(
	argsArray: string[],
	cwd: string,
	baseEnv: Record<string, string>,
	timeoutMs: number,
	toolName: string
): (token: string) => Promise<string> {
	return async (token) => {
		// gh reads GH_TOKEN automatically from the environment — no need for --token flag.
		const subprocess = Bun.spawn(['gh', ...argsArray], {
			cwd,
			env: {...baseEnv, GH_TOKEN: token},
			timeout: timeoutMs,
		});

		// Read both streams in parallel to prevent pipe buffer exhaustion (deadlock).
		const [stdout, stderr] = await Promise.all([
			new Response(subprocess.stdout).text(),
			new Response(subprocess.stderr).text(),
		]);
		const exitCode = await subprocess.exited;
		const signalCode = subprocess.signalCode;

		if (signalCode === 'SIGTERM' && exitCode !== 0) {
			// Bun kills the process with SIGTERM on timeout; distinguish from normal exits.
			const secs = Math.round(timeoutMs / 1000);
			throw new ToolError(`Command timed out after ${secs}s`, {metadata: {toolName}});
		}

		if (exitCode !== 0) {
			// Combine both streams — gh may write to either stdout, stderr or both depending on the subcommand.
			const combined = [stdout, stderr].filter(Boolean).join('\n');
			throw new ToolError(`gh command failed with exit code ${exitCode}: ${combined}`, {metadata: {toolName}});
		}

		return stdout;
	};
}
