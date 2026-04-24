# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.1] - 2026-04-29

### Added
- GitHub CLI wrapper plugin for OpenCode with per-app credential isolation
- `gh-*` tool registration based on JSON configuration
- Token caching with LRU eviction and in-flight request deduplication
- Automatic token refresh on auth failures (401/403)
- Structured logging with OpenCode host integration
- Retry logic for transient network errors
- Comprehensive test suite
- CI workflow (GitHub Actions) for typecheck, lint, and test
- Configuration schema validation with Zod
