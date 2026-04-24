# OpenCode GitHub CLI Wrapper

This project is a minimal wrapper around the GitHub CLI (`gh`). Its only function is to inject a pre-configured authentication token into the CLI execution and pass the raw output directly to the user. It performs no sanitization, validation, or intent-checking. The tool enables multi-agent isolation by binding each AI agent to a dedicated GitHub App token. This allows multiple agents running on the same OpenCode instance to independently comment, create pull requests, and review code with their own distinct identities, without sharing credentials or affecting each other's context.

## Principles (Karpathy-Inspired)
- Think before coding — State assumptions explicitly; push back when a simpler approach exists.
- Simplicity first — No abstractions for single-use code, no speculative features, no over-engineering.
- Surgical changes — Touch only what the task requires; match existing style; don't refactor unrelated code.
- Goal-driven execution — Define verifiable success criteria; write tests first for bug fixes and new behavior.

## Repo‑specific commands
- Run unit tests: `bun test ./path/to/my-file.test.ts`.
- Run all unit tests: `bun run test`.
- Run tests with coverage: `bun run coverage`.
- Lint code: `bun run lint`.
- Type‑check only: `bun run typecheck`.

## Entry point & output
- Main entry: `src/main.ts` → compiled ESM module named `gh-cli-wrapper.js`.

## Dependency management
- Dependencies are managed via Bun (`bun.lock`).
- Adding a new dependency requires updating the `external` array in `build.ts`.

## Configuration
- External modules listed in build script must be whitelisted; any addition/removal needs corresponding change in `external` list.

## Testing

Tests should follow the projects [testing standards](TESTING.md). Run specific tests for changed code during development. If fixing a specific error, run the corresponding test. Only run the complete test suite or validation after development is complete and related tests pass.

## Style & linting
- Follow existing EditorConfig rules (`.editorconfig`); do not add new rules.
- Use TypeScript strict mode; ensure code passes `bun run typecheck`.
- Fix linting indentation erros with `bun run lintf`

## CI & PR workflow
- CI runs `bun run verify` on every PR.
- Ensure verification passes locally before pushing.

## Security & secrets
- Never commit `.env` or secret keys; use the secret store for credentials.
