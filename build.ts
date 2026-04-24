/**
 * Build script for the OpenCode GitHub CLI Wrapper plugin.
 * Compiles `src/main.ts` to ESM in `./dist` by default.
 *
 * Usage:
 *   bun run build.ts              # Build to ./dist
 *   bun run build.ts --install    # Build to ./dist and copy to opencode plugins directory
 *
 * External dependencies are listed below and must match package.json.
 * These packages are bundled as external so they are resolved at runtime
 * from the OpenCode installation rather than being inlined.
 */

import { build } from "bun";
import { homedir } from "os";
import { join } from "path";
import { existsSync, mkdirSync, copyFileSync } from "fs";

const PLUGIN_NAME = "gh-cli-wrapper";
const OUTDIR = "./dist";
const OPENCODE_PLUGINS_DIR = join(homedir(), ".config", "opencode", "plugins"); // standard OpenCode plugin directory
const EXTERNAL_DEPENDENCIES = [
	"@opencode-ai/plugin",
	"shell-quote",
	"octokit",
	"zod",
];

const shouldInstall = process.argv.includes("--install");

const result = await build({
	entrypoints: ["./src/main.ts"],
	outdir: OUTDIR,
	target: "bun",
	format: "esm",
	naming: `${PLUGIN_NAME}.js`,
	external: EXTERNAL_DEPENDENCIES,
});

if (!result.success) {
	console.error("Build failed:");
	for (const log of result.logs) {
		console.error(log);
	}
	process.exit(1);
}

for (const output of result.outputs) {
	console.log(`Built: ${output.path}`);
}

if (shouldInstall) {
	const srcPath = join(OUTDIR, `${PLUGIN_NAME}.js`);
	const destPath = join(OPENCODE_PLUGINS_DIR, `${PLUGIN_NAME}.js`);

	// Ensure destination directory exists
	if (!existsSync(OPENCODE_PLUGINS_DIR)) {
		mkdirSync(OPENCODE_PLUGINS_DIR, { recursive: true });
	}

	copyFileSync(srcPath, destPath);
	console.log(`Installed: ${destPath}`);
}
