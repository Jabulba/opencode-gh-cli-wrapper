// Copyright (c) 2026 Jabulba. MIT License.
import {z} from 'zod';
import {promises as fs} from 'fs';
import { join } from 'path';
import {logger} from './logger';
import {ConfigError} from './errors';

/**
 * The relative file path to the default configuration file for GitHub applications.
 */
export const DEFAULT_CONFIG_RELATIVE_PATH = '.opencode/gh-apps.json';

/**
 * The default timeout duration for configuration operations, specified in milliseconds.
 * This constant defines a 60-second timeout threshold applied when a custom timeout is not explicitly configured.
 */
export const DEFAULT_CONFIG_TIMEOUT_MS = 60_000;


/**
 * Defines the validation schema for an application entry configuration.
 * Specifies the required application name, an optional description,
 * and an optional command execution timeout in milliseconds.
 * The `name` field is normalized: lowercased, spaces replaced with dashes,
 * diacritics stripped, and all non `[a-z0-9-]` characters removed.
 */
export const AppEntrySchema = z.object({
	name: z.string()
		.trim()
		.min(1, "App name must not be empty")
		.max(34, "App name must not exceed 34 characters") // GitHub App name length limit safeguard
		.transform((val) =>
			val
				.toLowerCase()
				.replace(/ /g, "-") // preserve word boundaries before stripping non-alphanumeric
				.normalize("NFD") // decompose accented chars so combining marks can be stripped
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/[^a-z0-9-]/g, ""), // final: only lowercase alphanums and dashes
		),
	description: z.string().optional(),
	timeout_ms: z.int().positive()
		.optional()
		.describe(`Command timeout in milliseconds. Defaults to the global config's timeout_ms.`),
});

/**
 * Defines the Zod validation schema for the application configuration object.
 * Enforces positive integer constraints for command timeouts,
 * while validating the collection of application entries.
 * Applies default values to configuration parameters when they are omitted.
 */
const ConfigSchema = z.object({
	timeout_ms: z.int().positive()
		.default(DEFAULT_CONFIG_TIMEOUT_MS)
		.describe(`Global default for command timeout in milliseconds (default: ${DEFAULT_CONFIG_TIMEOUT_MS})`),
	apps: AppEntrySchema.array(),
});

/**
 * Configuration object for GitHub CLI Wrapper settings.
 * Defines the parameters and application list for the wrapper.
 */
interface GitHubCLIWrapperConfig {
	/**
	 * The maximum time in milliseconds to wait for an operation to complete.
	 */
	timeout_ms: number;

	/**
	 * An array of applications to be loaded.
	 */
	apps: AppEntry[];
}

/**
 * Configuration for a single GitHub App entry in the wrapper config.
 */
export interface AppEntry {
	/**
	 * The name of the application.
	 */
	name: string;

	/**
	 * A description associated with the application.
	 * This field is optional.
	 */
	description?: string;

	/**
	 * The maximum time in milliseconds to wait for an operation to complete.
	 * This value is optional.
	 */
	timeout_ms?: number;
}

/**
 * Loads and validates the GitHub CLI wrapper configuration from a JSON file.
 * The configuration path is determined by the GH_APPS_CONFIG_PATH environment variable,
 * or defaults to a standard relative path. The file content is parsed and validated
 * against a predefined schema. Throws an error if the file is missing, contains
 * invalid JSON, or fails validation.
 * @return {Promise<GitHubCLIWrapperConfig>} A promise that resolves to the validated configuration object.
 */
export async function loadConfig(): Promise<GitHubCLIWrapperConfig> {
	const configFilePath = process.env.GH_APPS_CONFIG_PATH || join(process.cwd(), DEFAULT_CONFIG_RELATIVE_PATH);

	let content: string;
	try {
		content = await fs.readFile(configFilePath, 'utf8');
	} catch (error: unknown) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
			throw new ConfigError('Configuration file not found', { cause: error });
		}

		throw new ConfigError('Failed to read configuration file', { cause: error });
	}

	let rawConfigJSON: unknown;
	try {
		rawConfigJSON = JSON.parse(content);
	} catch (error: unknown) {
		throw new ConfigError('Configuration file contains invalid JSON', { cause: error });
	}

	const safeParseConfig = ConfigSchema.safeParse(rawConfigJSON);
	if (!safeParseConfig.success) {
		throw new ConfigError('Configuration file does not match the expected format', { cause: safeParseConfig.error });
	}

	if (safeParseConfig.data.apps.length === 0) {
		// Warn but don't fail — allows a config file to exist with no apps (e.g. staged but not yet populated).
		await logger.warn({ message: 'App config is empty, no gh-* tools will be registered', meta: { configData: safeParseConfig.data } });
	}

	return safeParseConfig.data;
}
