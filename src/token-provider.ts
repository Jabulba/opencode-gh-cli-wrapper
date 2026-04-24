// Copyright (c) 2026 Jabulba. MIT License.
import { resolve } from 'path';
import {App} from 'octokit';
import {promises as fs} from 'fs';
import {z} from 'zod';
import {LruMap} from './lru-map';
import {PemReadError, TokenError} from './errors';

/** Token cache validity buffer (2 minutes before expiry). */
const CACHE_BUFFER_MS = 120_000;

/** Fallback token expiry when Octokit does not return expiresAt (~58 minutes). */
const DEFAULT_TOKEN_EXPIRY_MS = 3_500_000;

/**
 * Zod schema defining the structure for environment configuration settings.
 * Requires an application ID, a positive installation ID,
 * and a path to a PEM file.
 */
export const EnvConfigSchema = z.object({
	appId: z.string().nonempty(),
	installId: z.coerce.number().positive(),
	pemPath: z.string().nonempty(),
});

/**
 * Represents a cached token containing the token string and its expiration time.
 */
interface CachedToken {
	token: string;
	expiresAt: number;
}

/**
 * Represents the result of an authentication process for installation.
 * Contains the authentication token and optionally the time when the token expires.
 */
interface InstallationAuthResult {
	token: string;

	expiresAt?: string;
}

/**
 * Provides methods for obtaining and managing application and installation tokens.
 */
export class TokenProvider {
	readonly #tokenCache: LruMap<string, CachedToken>; // caches tokens per appId:installId
	readonly #appsCache: LruMap<string, App>;          // caches Octokit App instances (expensive to create)
	readonly #inFlight: Map<string, Promise<string>>;  // request collapsing: deduplicates concurrent mints

	constructor() {
		this.#tokenCache = new LruMap<string, CachedToken>(100);
		this.#appsCache = new LruMap<string, App>(100);
		this.#inFlight = new Map<string, Promise<string>>();
	}

	/**
	 * Retrieves the installation token for a given application and installation.
	 * It first checks a local cache for a token that is valid for at least two minutes.
	 * If a valid token is found in the cache, it is returned immediately.
	 * Otherwise, a new token is minted using the provided parameters.
	 *
	 * @param appId The application ID.
	 * @param installationId The installation ID.
	 * @param pemPath The path to the PEM file.
	 * @returns A promise that resolves to the installation token string.
	 */
	async getInstallationToken(appId: string, installationId: number, pemPath: string): Promise<string> {
		const cacheKey = `${appId}:${installationId}`; // composite key ensures per-app isolation

		// Check valid cache (token must have > 2 minutes remaining)
		const cached = this.#tokenCache.get(cacheKey);
		if (cached && cached.expiresAt > Date.now() + CACHE_BUFFER_MS) {
			return cached.token;
		}

		return this.#mintToken(cacheKey, appId, installationId, pemPath);
	}

	/**
	 * Retrieves or generates a GitHub App installation token, caching the result
	 * and preventing duplicate concurrent requests.
	 * @param cacheKey - Unique identifier for caching and deduplicating concurrent requests.
	 * @param appId - The GitHub App ID used to fetch the application configuration.
	 * @param installationId - The installation ID to authenticate against.
	 * @param pemPath - File path to the PEM private key for the GitHub App.
	 * @return A promise that resolves to the installation access token string.
	 */
	async #mintToken(
		cacheKey: string,
		appId: string,
		installationId: number,
		pemPath: string,
	): Promise<string> {
		// getOrInsertComputed collapses concurrent requests: only one actual mint runs, others await the same promise.
		return this.#inFlight.getOrInsertComputed(cacheKey, () =>
			(async () => {
				try {
					let app = await this.getApp(appId, pemPath);
					const octokit = await app.getInstallationOctokit(installationId);
					const authResult = (await octokit.auth({type: 'installation'})) as InstallationAuthResult;

					if (!authResult.token) {
						throw new TokenError('Failed to obtain installation token from Octokit', {metadata: {appId}});
					}

					this.#tokenCache.set(cacheKey, {
						token: authResult.token,
						// Octokit may omit expiresAt; fall back to a conservative 58-minute default.
						expiresAt: authResult.expiresAt ? new Date(authResult.expiresAt).getTime() : Date.now() + DEFAULT_TOKEN_EXPIRY_MS,
					});

					return authResult.token;
				} finally {
					// Clean up the in-flight entry so future requests trigger a fresh mint.
					this.#inFlight.delete(cacheKey);
				}
			})(),
		);
	}

	/**
	 * Invalidates the cached token for a given application and installation.
	 * Called when a stale token is detected (e.g., 401/403 from gh).
	 * Note: does not cancel in-flight mints; a pending mint will still cache the new token.
	 *
	 * @param appId The application ID.
	 * @param installationId The installation ID.
	 */
	invalidate(appId: string, installationId: number): void {
		this.#tokenCache.delete(`${appId}:${installationId}`);
	}

	/**
	 * Retrieves or creates an App instance associated with a given application ID and private key path.
	 *
	 * @param appId The unique identifier for the application.
	 * @param pemPath The file path to the private key in PEM format.
	 * @return A Promise that resolves to the App instance.
	 */
	private async getApp(appId: string, pemPath: string) {
		// Cache App instances per appId to avoid recreating them on every token mint.
		let app = this.#appsCache.get(appId);
		if (!app) {
			const privateKey = await this.readPrivateKey(pemPath);
			app = new App({appId, privateKey});
			this.#appsCache.set(appId, app);
		}

		return app;
	}

	/**
	 * Reads the private key from a specified PEM file.
	 *
	 * @param pemPath The path to the PEM file containing the private key.
	 * @returns A promise that resolves with the content of the private key file as a string.
	 */
	private async readPrivateKey(pemPath: string): Promise<string> {
		const resolvedPemPath = resolve(pemPath); // absolute path ensures consistent cache keys across cwd changes

		try {
			return await fs.readFile(resolvedPemPath, 'utf8');
		} catch (error: unknown) {
			throw new PemReadError('Failed to read private key file', { cause: error });
		}
	}
}
