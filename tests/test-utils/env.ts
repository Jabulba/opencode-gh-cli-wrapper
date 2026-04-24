/**
 * Sets up app-specific environment variables for integration tests.
 * Creates GH_APP_ID_{suffix}, GH_INSTALL_ID_{suffix}, GH_PEM_PATH_{suffix}.
 */
export function setupAppEnv(
	suffix: string,
	appId = '123',
	installId = '456',
	pemPath = '/fake/key.pem',
): void {
	process.env[`GH_APP_ID_${suffix}`] = appId;
	process.env[`GH_INSTALL_ID_${suffix}`] = installId;
	process.env[`GH_PEM_PATH_${suffix}`] = pemPath;
}

/**
 * Cleans up GitHub-related environment variables set during tests.
 * Removes all env vars starting with GH_APP_ID_, GH_INSTALL_ID_, GH_PEM_PATH_,
 * and GH_APPS_CONFIG_PATH.
 */
export function cleanupEnv(): void {
	for (const key of Object.keys(process.env)) {
		if (
			key.startsWith('GH_APP_ID_') ||
			key.startsWith('GH_INSTALL_ID_') ||
			key.startsWith('GH_PEM_PATH_')
		) {
			delete process.env[key];
		}
	}
	delete process.env.GH_APPS_CONFIG_PATH;
}
