// Copyright (c) 2026 Jabulba. MIT License.

/**
 * A flexible dictionary for attaching arbitrary metadata to error objects.
 */
export interface ErrorMetadata {
	[key: string]: unknown;
}

/**
 * Abstract base class for custom application errors.
 *
 * Extends the native Error class to provide a standardized structure for error handling within the application.
 *
 * Subclasses should implement specific error types while inheriting common behavior and metadata support.
 * @param message - A descriptive message explaining the error.
 * @param options - Optional configuration for the error instance.
 * @param options.cause - The underlying cause of the error, if applicable.
 * @param options.metadata - Additional contextual data associated with the error.
 */
export abstract class AppError extends Error {
	readonly name: string;
	readonly metadata: ErrorMetadata | undefined;

	protected constructor(message: string, options?: { cause?: unknown; metadata?: ErrorMetadata }) {
		super(message, options);
		this.name = this.constructor.name;
		this.metadata = options?.metadata;
		Object.setPrototypeOf(this, new.target.prototype); // fix prototype chain so instanceof works for subclasses
	}
}

/**
 * Represents an error thrown when a configuration issue occurs.
 *
 * Extends AppError to provide context-specific error handling for configuration related problems.
 */
export class ConfigError extends AppError {
	constructor(
		message: string,
		options?: { cause?: unknown; metadata?: ErrorMetadata },
	) {
		super(message, options);
	}
}

/**
 * Represents an error that occurs during the reading or parsing of a PEM-formatted file or data.
 *
 * Extends AppError to provide context-specific error handling for PEM related operations.
 */
export class PemReadError extends AppError {
	constructor(
		message: string,
		options?: { cause?: unknown; metadata?: ErrorMetadata },
	) {
		super(message, options);
	}
}

/**
 * Represents an error thrown during token validation, expiration, or processing.
 *
 * Extends AppError to provide context-specific error handling for token related failures.
 */
export class TokenError extends AppError {
	constructor(
		message: string,
		options?: { cause?: unknown; metadata?: ErrorMetadata },
	) {
		super(message, options);
	}
}

/**
 * Represents an error thrown during tool execution.
 *
 * Extends AppError to provide context-specific error handling for tool related failures.
 */
export class ToolError extends AppError {
	constructor(
		message: string,
		options?: { cause?: unknown; metadata?: ErrorMetadata },
	) {
		super(message, options);
	}
}

/**
 * Represents an error thrown during environment configuration validation or loading.
 *
 * Extends AppError to provide context-specific error handling for environment variable related failures.
 */
export class EnvConfigError extends AppError {
	constructor(
		message: string,
		options?: { cause?: unknown; metadata?: ErrorMetadata },
	) {
		super(message, options);
	}
}
