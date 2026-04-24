// Copyright (c) 2026 Jabulba. MIT License.
/**
 * @module utils
 * @description Utility functions for the GitHub CLI Wrapper plugin: environment variable
 * suffix generation, tool name normalization, and shell argument parsing.
 */

import {parse} from 'shell-quote';


/**
 * Converts an app name to a SCREAMING_SNAKE_CASE environment variable suffix.
 * @param name The human-readable name of the app.
 * @returns The SCREAMING_SNAKE_CASE suffix used for environment variables.
 */
export function getEnvSuffix(name: string): string {
	return name.toUpperCase().replace(/-/g, '_');
}


/**
 * Parses a shell argument string and extracts its components into an array of strings.
 * Processes the input by tokenizing it and collecting strings, patterns, operators, and comments.
 * @param args The shell argument string to parse.
 * @return An array of string tokens extracted from the input.
 */
export function splitShellArgs(args: string): string[] {
	const parsed = parse(args, {});

	const result: string[] = [];
	for (const token of parsed) {
		if (typeof token === 'string') {
			result.push(token);
		} else if (typeof token === 'object' && token !== null) {
			// Flatten shell-quote AST nodes back to strings: gh expects a flat arg array, not a shell AST.
			if ('pattern' in token) {
				result.push((token as { pattern: string }).pattern);
			} else if ('op' in token) {
				result.push((token as { op: string }).op);
			} else if ('comment' in token) {
				result.push((token as { comment: string }).comment);
			}
		}
	}

	return result;
}

/**
 * Error codes indicating transient network failures that warrant retry.
 */
const TRANSIENT_NETWORK_CODES = new Set([
	'ECONNRESET',
	'ECONNREFUSED',
	'ENOTFOUND',
	'EAI_AGAIN',
	'ETIMEDOUT',
]);

/**
 * Check if an error is transient and should be retried.
 *
 * Skips retry for non-retryable errors: TimeoutError, and errors that do not
 * match transient failure patterns (network errors, HTTP 429/502/503/504).
 */
export function isTransientError(error: unknown): boolean {
	if (error instanceof Error) {
		// Never retry timeouts
		if (error.name === 'TimeoutError') return false;

		const message = error.message;
		const cause = error.cause;
		const causeMessage = cause instanceof Error ? cause.message : String(cause);

		// Check error code (Bun.spawn network errors)
		const code = (error as Error & { code?: string }).code;
		if (code && TRANSIENT_NETWORK_CODES.has(code)) return true;
		if (TRANSIENT_NETWORK_CODES.has(causeMessage)) return true; // check nested cause chain (Bun errors wrap underlying errors)

		// Check HTTP status codes from gh CLI output
		if (/\b(429|502|503|504)\b/.test(message)) return true;
		if (/\b(429|502|503|504)\b/.test(causeMessage)) return true; // also check cause chain for wrapped HTTP errors
	}

	return false;
}

/**
 * Executes an asynchronous command with retry logic for transient errors.
 * @param cmd - The async function to execute, which returns a Promise resolving to a string.
 * @param maxRetries - The maximum number of retry attempts. Defaults to 2.
 * @param baseDelay - The initial delay in milliseconds before the first retry. Defaults to 1000.
 * @return A Promise that resolves to the string returned by the command on success, or rejects with the last encountered error if all retries are exhausted or a non-transient error occurs.
 */
export async function runWithRetry(
	cmd: () => Promise<string>,
	maxRetries: number = 2,
	baseDelay: number = 1000,
): Promise<string> {
	for (let i = 0; i <= maxRetries; i++) {
		try {
			return await cmd();
		} catch (error) {
			// Non-retryable errors: throw immediately
			if (!isTransientError(error)) {
				throw error;
			}

			// Last attempt exhausted: throw without delay
			if (i >= maxRetries) {
				throw error;
			}

			// Exponential backoff with jitter
			const currentBaseDelay = baseDelay * Math.pow(2, i);
			const jitter = Math.random() * (currentBaseDelay / 2);
			const delay = Math.floor(currentBaseDelay + jitter);

			await new Promise((resolve) => setTimeout(resolve, delay));
		}
	}

	throw new RangeError(`maxRetries must be >= 0, got ${maxRetries}`);
}
