// Copyright (c) 2026 Jabulba. MIT License.
type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
	message: string
	meta?: Record<string, unknown>
}

type ClientLogFn = (params: { body: { service: string; level: LogLevel; message: string; extra?: Record<string, unknown> } }) => Promise<void>

/**
 * Structured logger with optional OpenCode client sink.
 * Falls back to console[level] when init() has not been called.
 *
 * Lifecycle: create → init(clientLogFn) → debug/info/warn/error
 * Re-initialization warns and discards the previous sink.
 */
export class Logger {
	private logFn: ClientLogFn | null

	constructor() {
		this.logFn = null
	}

	/**
	 * Wire the logger to an OpenCode client log function.
	 * Calling again warns and replaces the previous sink.
	 * @param clientLogFn - The OpenCode client's log function.
	 */
	init(clientLogFn: ClientLogFn) {
		if (this.logFn !== null) {
			console.warn('[logger] init called multiple times; previous logFn discarded')
		}
		// Host log function is the primary sink; null means no host → fall back to console.
		this.logFn = clientLogFn
	}

	/** Whether init() has been called. */
	get isInitialized() {
		return this.logFn !== null
	}

	/**
	 * Log a message at the given level.
	 * @param entry - Message string and optional metadata record.
	 */
	debug(entry: LogEntry) { return this._log('debug', entry) }
	info(entry: LogEntry)  { return this._log('info', entry) }
	warn(entry: LogEntry)  { return this._log('warn', entry) }
	error(entry: LogEntry) { return this._log('error', entry) }

	/**
	 * Logs a message at the specified level, routing it through a custom log function or falling back to the console.
	 * @param {LogLevel} level - The severity level of the log entry.
	 * @param {LogEntry} entry - The log entry containing the message and metadata.
	 * @return {Promise<void>} A promise that resolves when the logging operation completes.
	 */
	async _log(level: LogLevel, entry: LogEntry): Promise<void> {
		if (!this.logFn) {
			console[level](`[gh-cli-wrapper] ${entry.message}`) // no host → direct console output
			return
		}
		try {
			await this.logFn({
				body: {
					service: 'gh-cli-wrapper',
					level,
					message: entry.message,
					extra: entry.meta,
				},
			})
		} catch (err) {
			// Never let a broken host log sink crash the plugin; degrade to console.
			console.error(`log sink error: ${err instanceof Error ? err.message : String(err)}`)
		}
	}
}

/** The singleton logger instance. Call logger.init() before use. */
export const logger = new Logger()
