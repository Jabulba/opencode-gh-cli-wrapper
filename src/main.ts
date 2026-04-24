// Copyright (c) 2026 Jabulba. MIT License.
import {type Plugin, tool} from "@opencode-ai/plugin";
import {loadConfig} from "./config";
import {EnvConfigSchema, TokenProvider} from "./token-provider";
import {EnvConfigError} from "./errors";
import {getEnvSuffix} from "./utils";
import {logger} from "./logger";
import {getToolExecutor} from "./tool-executor";

/**
 * Plugin that registers GitHub CLI tools based on environment configurations.
 * It iterates through configured applications, reads necessary credentials from environment variables,
 * and registers a corresponding tool for interacting with GitHub via the gh CLI.
 * Each tool is configured with specific argument handling, timeouts, and authentication.
 * Tokens are fetched lazily at execution time using the provided GitHub App credentials
 * (app ID, installation ID, and PEM path).
 * The tool registration process will throw an error if required environment variables are missing for any configured application.
 *
 * @param client - The OpenCode SDK client instance, used to wire the plugin's
 *                 logger to the host application's logging system.
 * @returns A plugin object with a `tool` record mapping tool names (e.g., `gh-default`)
 *          to registered tool definitions.
 */
export const GitHubCLIWrapper: Plugin = async ({client}) => {
	// Wire logger to OpenCode host so plugin output appears in the same log stream.
	if (client.app?.log) {
		logger.init(async (params) => {
			await client.app.log(params);
		});
	}
	// Shared across all tools so token caches (LRU + in-flight dedup) are not duplicated per-app.
	const tokenProvider = new TokenProvider();
	const config = await loadConfig();
	const tools: Record<string, ReturnType<typeof tool>> = {};

	for (const app of config.apps) {
		const toolName = `gh-${app.name}`;
		const envSuffix = getEnvSuffix(app.name);
		const timeoutMs = app.timeout_ms ?? config.timeout_ms;

		// Env var naming convention: suffix is the app name in SCREAMING_SNAKE_CASE (e.g. GH_APP_ID_DEFAULT).
		const appIdEnvName = `GH_APP_ID_${envSuffix}`;
		const installIdEnvName = `GH_INSTALL_ID_${envSuffix}`;
		const pemPathEnvName = `GH_PEM_PATH_${envSuffix}`;
		const envResult = EnvConfigSchema.safeParse({
			appId: process.env[appIdEnvName],
			installId: process.env[installIdEnvName],
			pemPath: process.env[pemPathEnvName],
		});

		if (!envResult.success) {
			const envVarNames = [appIdEnvName, installIdEnvName, pemPathEnvName];
			// Record which vars are present vs missing so the error message is actionable without exposing secrets.
			throw new EnvConfigError(`Tool registration failed: Missing environment configuration for app: ${app.name}`, {
				metadata: Object.fromEntries(envVarNames.map(name => [name, process.env[name] != null ? 'ok' : 'missing']))
			});
		}

		const {appId, installId, pemPath} = envResult.data;

		tools[toolName] = tool({
			description: app.description || `GitHub CLI, Work seamlessly with GitHub from the command line.`,
			args: {
				ghArgs: tool.schema.string().describe("The arguments to pass to the gh CLI"),
			}, execute: getToolExecutor(toolName, timeoutMs, tokenProvider, appId, installId, pemPath),
		});
	}

	return {
		tool: tools,
	};
};
