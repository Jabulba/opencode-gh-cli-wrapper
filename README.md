# OpenCode GitHub CLI Wrapper Plugin

Exposes `gh-*` tools that call the GitHub CLI with specific GitHub App credentials, isolated per app.

## Installation

### Prerequisites

- [GitHub CLI (`gh`)](https://cli.github.com) installed and available on `PATH`

### Install

Add opencode-gh-cli-wrapper to the plugin array in your opencode.json (global or project-level):

```json
{
  "plugin": ["jabulba@git+https://github.com/jabulba/opencode-gh-cli-wrapper.git"]
}
```

Deny access to the original `gh` command in `opencode.json`, if using multiple apps, deny `"gh_": "deny"` globally and allow each app on the corresponding agent
```json
{
  "permission": {
    "bash": {
      "gh*": "deny"
    }
  }
}
```

Restart OpenCode. The plugin auto-installs via Bun and registers all skills automatically.

Verify by asking "List all available tools starting with gh_" to an agent with access to it.

### Quick Start

1. **Create a config file** at `.opencode/gh-apps.json`:

   At least `app.name` must be present of a tool to be registered

```json
{
  "timeout_ms": 60000,
  "apps": [
    {
      "name": "my-app",
      "description": "Execute GitHub operations for the My App project",
      "timeout_ms": 60000
	}
  ]
}
```

2. **Set environment variables** for each app (suffix derived from app name, e.g. `my-app` → `MY_APP`):

```bash
export GH_APP_ID_MY_APP=123456
export GH_INSTALL_ID_MY_APP=789012
export GH_PEM_PATH_MY_APP=/absolute/path/to/app.private-key.pem
```

3. **Start OpenCode** — the `gh-my-app` tool will be available automatically.

```
gh-my-app: Execute GitHub operations as my-app. Provide arguments as gh CLI.
  - ghArgs (string): The arguments to pass to the gh CLI
```

## Configuration

The configuration file is a JSON object with global defaults and an `apps` array:

```json
{
  "timeout_ms": 60000,
  "apps": [
    {
      "name": "my-app",
      "description": "Execute GitHub operations for the My App project"
    }
  ]
}
```

Each entry requires corresponding environment variables with a suffix derived from the app name:

| Variable | Description |
|----------|-------------|
| `GH_APP_ID_<SUFFIX>` | GitHub App numeric ID |
| `GH_INSTALL_ID_<SUFFIX>` | GitHub App Installation ID |
| `GH_PEM_PATH_<SUFFIX>` | Absolute path to the PEM private key file |

The suffix is derived by converting the app name to a normalized SCREAMING_SNAKE_CASE (e.g., `my-app` → `MY_APP`).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GH_APPS_CONFIG_PATH` | Optional: absolute path to a custom config file |

## Usage

Once installed, `gh-*` tools are available in OpenCode. Each tool accepts `ghArgs` — the arguments to pass to the `gh` CLI:

```
gh-my-app: GitHub CLI, Work seamlessly with GitHub from the command line.
  - ghArgs (string): The arguments to pass to the gh CLI
```

## Development

```bash
# Install dependencies
bun install

# Type-check
bun run typecheck

# Lint
bun run lint

# Run tests
bun test

# Coverage must be > 90%
bun run coverage

# Build the plugin
bun run build

# Validate the package before release
npm pack --dry-run

# Install the plugin to OpenCode globally
bun run install
```

## License

MIT

## Name Normalization

App names are normalized to lowercase, spaces replaced with hyphens, non-alphanumeric characters (except hyphens) removed, and diacritics stripped. Names are truncated to 34 characters to comply with GitHub App naming constraints.

## Trademark Notice

GitHub and the GitHub logo are trademarks of GitHub, Inc. OpenCode is a trademark of its respective owner. This project is not endorsed by or affiliated with either.

## Activity

![Alt](https://repobeats.axiom.co/api/embed/19aa79d1b618ee71b04078a8af9bdc86f636324a.svg "Repobeats analytics image")
