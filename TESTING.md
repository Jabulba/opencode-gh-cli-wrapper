# Test Specification

Conventions for writing, organizing, and maintaining tests in this project.

## 1. File Organization

To prevent large files and facilitate AI context management, the project uses a directory-per-component structure for tests.

### 1.1 Component Test Folders
Every source module must have a corresponding test directory in the `tests/` root:
- `src/foo.ts` -> `tests/foo.tests/`
- `src/modules/bar.ts` -> `tests/modules/bar.tests/`

### 1.2 Feature Test Files
Within a component folder, tests are split into smaller files based on feature or behavior group. This avoids "giant files" and ensures each file focuses on a single aspect of the module.
- **Naming**: `tests/<component_path>.tests/<feature>.test.ts`
- **Example**: `src/auth/token-provider.ts` is tested via:
    - `tests/auth/token-provider.tests/cache.test.ts`
    - `tests/auth/token-provider.tests/in-flight.test.ts`
- *Note*: Since the file is already inside a component folder, the module name is implicit and does not need to be the first `describe` block.

## 1.3 Test Utilities

Shared test utilities live in `tests/test-utils/`. They eliminate boilerplate, reduce duplication, and keep test files focused on behavior. When a pattern repeats across 2+ test files:

1. Evaluate whether the shared logic belongs in an existing utility file (choose by domain: env, mock, factory, etc.).
2. If no existing file fits, add a new file to `tests/test-utils/` with a clear, descriptive name.
3. Export only public helpers — keep private implementation details file-scoped.

## 2. Imports

Import explicitly from `bun:test` in the following order:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
```

- Always include `vi` when using any `vi.*` function, even if only one is used.
- Do not destructure more than needed. If a test uses only `describe`, `it`, and `expect`, omit the rest.
- Do not use `spyOn` from `bun:test` — use `vi.fn()` and `vi.spyOn()` instead for consistency.

## 3. Test Structure

### 3.1 describe Nesting

- Use nested `describe` blocks to group related tests.
- Maximum depth: **3 levels**.
- Level 1: feature or behavior group (e.g., `describe('token cache')`).
- Level 2: specific scenario (e.g., `describe('positive cases')`).
- Level 3: edge case or variant (e.g., `describe('expired tokens')`).


### 3.2 it Blocks

- Each `it` tests exactly one claim or assertion group.
- Test names follow the pattern: "{functionName} <condition> → <expected result>" or "<behavior>".
- Example: '{getToken} cache hit → no re-mint (second call with same key)'.

### 3.3 Structure Template

Every `it` block MUST follow the **Arrange-Act-Assert (AAA)** pattern to ensure separation of concerns, except when testing thrown exceptions `expect(fn_call).rejects.toThrow('err')` .

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'bun:test';
import { someFunction } from '../src/module';

describe('moduleName', () => {
  beforeEach(() => { /* shared setup */ });
  afterEach(() => { /* shared teardown */ });

  describe('featureGroup', () => {
    it('{fnName} condition → expected result', () => {
      // Arrange: Setup mocks, inputs, and environment
      const input = 'test-value';
      
      // Act: Execute the single operation being tested
      const result = someFunction(input);
      
      // Assert: Verify the output or side-effects
      expect(result).toBe('expected-value');
    });
    it('{fnName} condition → expected throw', () => {
      // Arrange: Setup mocks, inputs, and environment
      const input = 'test-value';
      
      // Act & Assert: Execute the single operation being tested & verify the output or side-effects
      expect(someFunction(input)).rejects.toThrow('expected-value');
    });
  });
});
```

### 3.4 Parameterized Tests

Use `it.each` for boundary, validation, and edge case testing to avoid repetitive `it` blocks. Group related inputs into a table to ensure all variants are covered.

Example:
```ts
it.each([
  ['invalid_token', 'invalid token format'],
  ['', 'token cannot be empty'],
  [' ', 'token cannot be whitespace'],
])('{validateToken} input "%s" → throws %s', (input, expectedError) => {
  expect(() => validateToken(input)).toThrow(expectedError);
});
```

## 4. Setup & Teardown

### 4.1 beforeEach

Use `beforeEach` only when tests share setup logic. Common patterns:
- Mocking console output: `global.console.log = global.console.info = global.console.error = vi.fn();`
- Clearing module-level mock functions: `mockFn.mockClear();`
- Resetting process.env keys set by the test

Do NOT use `beforeEach` for:
- Per-test setup (put it inside the `it` block).
- Mocking that is only needed by one or two tests.

### 4.2 afterEach

Use `afterEach` only when tests share teardown logic.

- Default cleanup: `vi.resetAllMocks();`
- Use `vi.restoreAllMocks()` only when `vi.stubGlobal()` or `vi.spyOn()` with `mockRestore` is used.
- Clean up `process.env` mutations that affect other tests.
- Do NOT use `afterEach` when no shared teardown is needed (e.g., `errors.test.ts`).

### 4.3 Console Mocking

Mock console output in `beforeEach` only when the source module calls `console.log`, `console.info`, or `console.error` directly during the tested operation. Do not mock console for:
- Error class tests (errors don't call console).
- Logger tests (logger uses its own mock client).

## 5. Mocking

### 5.1 Module-Level Mocks

Define mock functions at module level when multiple tests need to reconfigure them:

```ts
const mockReadFile = vi.fn();

void vi.mock('fs', () => ({
  promises: { readFile: mockReadFile },
}));
```

- Use `void` to discard the promise returned by `vi.mock()`.
- Clear mocks in `beforeEach`: `mockReadFile.mockClear();`
- Do NOT use `vi.resetAllMocks()` to clear individual mocks — use `mockClear()` per mock function.

### 5.2 Inline Mocks

Define mocks inside `it` blocks when they are test-specific and not reused:

```ts
it('handles specific case', () => {
  vi.spyOn(someModule, 'fn').mockReturnValue('value');
  // ...
});
```

### 5.3 vi.mock() Placement

- `vi.mock()` calls must appear **before** any `import` of the module being tested.
- If the test imports the source module, `vi.mock()` must be declared before that import.
- Use inline factories for complex mocks to avoid hoisting issues:

```ts
const createMockTool = () => { /* ... */ };
void vi.mock('@opencode-ai/plugin', () => ({ tool: createMockTool() }));
```

### 5.4 Process.env

- **Isolation**: Avoid mutating `global` or `process` objects. If a mutation is required, it must be scoped to the `it` block and restored immediately in `afterEach`.
- Set `process.env` keys inside `it` blocks, not in `beforeEach`.
- Clean up `process.env` mutations in `afterEach` or at the end of the `it` block.
- Delete only the keys that were set, not all env vars.

## 6. Test Types

### 6.1 Unit Tests (Default)

All tests are unit tests by default. They test a single function, class, or module in isolation using mocks for external dependencies.

### 6.2 Integration Tests

Use the `.integration.test.ts` suffix only for tests that exercise the full plugin lifecycle or cross-module workflows. Example: `main.integration.test.ts` tests the `GitHubCLIWrapper` plugin with mocked subprocess execution.

### 6.3 Concurrent Tests

Tests should be designed for concurrency by default but use `it.concurrent` only for slow tests (e.g., those involving heavy I/O or timeouts) to run them simultaneously and reduce total suite execution time. For standard unit tests, prefer sequential execution to ensure maximum stability and easier debugging.

### 6.4 Fuzz Tests

- Group fuzz tests in a dedicated `describe` block at the bottom of the file.
- Document the iteration count explicitly.
- Keep fuzz helpers (`randStr`, `fuzzInput`) inside the `describe` block or as module-level private functions.
- Fuzz tests should assert invariants, not specific outputs.

## 7. Isolation & Reliability

To ensure stability and enable parallel execution in CI, all tests must adhere to the **Shared-Nothing Principle**.

### 7.1 The Shared-Nothing Principle
Each `it` block must be entirely self-contained. A test is considered isolated if it produces the same result regardless of:
- The order in which it is executed.
- Whether it is executed alone or in parallel with other tests.

### 7.2 State Isolation Rules
- **Mock Independence**: Prefer local mocks (defined inside `it`) over module-level mocks when tests are designed for concurrency. If using module-level mocks, they must be strictly reset using `mockClear()` in `beforeEach`.
- **Resource Isolation**: Tests must not rely on shared external resources (e.g., the same temporary file path). Use unique identifiers (UUIDs) or unique temporary directories for each test.
### 7.3 Concurrency Readiness

While sequential execution is preferred, tests that are marked as `it.concurrent` (typically slow tests) MUST be compatible with parallel execution. If a test absolutely must leak state or perform global mocking that cannot be isolated, it MUST be run in series (by omitting `it.concurrent`) to prevent interference with other tests. Ex:
- mutating a shared global singleton that cannot be mocked.
- files being created/deleted in a shared temporary directory.
- `vi.stubGlobal` on a resource that is shared across all tests in the file.

Avoiding shared state prevents "flaky tests" that only fail when the test suite grows or the environment changes.

### 7.4 Mock Reset Strategy

| Scenario | Method | When |
|----------|--------|------|
| Clear call history on individual mocks | `mockFn.mockClear()` | In `beforeEach` for module-level mocks |
| Reset all mocks (calls + implementations) | `vi.resetAllMocks()` | In `afterEach` as default cleanup |
| Restore original implementations | `vi.restoreAllMocks()` | When `vi.spyOn()` or `vi.stubGlobal()` is used |
| Reset mock state without restoring | `vi.clearAllMocks()` | Rare — only when you need to clear calls but keep implementations |

Do NOT mix strategies within a single test file. Pick one primary method and stick with it.


## 8. Assertions

### 8.1 Matchers

- Prefer `toBe` for primitive values and reference equality.
- Prefer `toEqual` for object/array equality.
- Prefer `toMatch` for regex matching on strings.
- Prefer `rejects.toThrow()` for async error assertions.
- Prefer `rejects.toThrow(regex)` over `rejects.toThrow(string)` for partial message matching.

### 8.2 Error Tests

```ts
it('throws on invalid input', () => {
  expect(() => fn(badInput)).toThrow(ErrorType);
});

it('rejects with specific message', async () => {
  await expect(fn(badInput)).rejects.toThrow(/expected pattern/);
});
```

### 8.3 Negative Cases

Test negative/edge cases explicitly with their own `it` blocks. Do not bundle multiple negative cases into a single `it` unless they test the same invariant (e.g., fuzz tests).

### 8.4 Truthy/Falsey

- Use `expect(value).toBe(true)` / `expect(value).toBe(false)` over `.toBeTruthy()` / `.toBeFalsy()`.
- Use `expect(value).toBeUndefined()` instead of relying on the absence of an error when a value is missing.


## 9. Coverage Requirements

Every public API must have corresponding tests:

- **Functions**: test happy path, error path, and edge cases (empty, null, undefined, boundaries).
- **Classes**: test constructor validation, each public method, and state transitions.
- **Schemas**: test valid input, coercion, each validation rule, and missing required fields.
- **Error classes**: test name, message, metadata and cause chain.
- **Modules with side effects** (e.g., logger init): test init, re-init warnings, and behavior after init.

### 9.1 Required Test Scenarios

For each function or method, ensure tests cover:

1. Happy path (expected success case).
2. Error path (throws/rejects with expected error).
3. Edge cases (empty string, null, undefined, zero, negative, max values).
4. Boundary conditions (max array length, timeout boundaries, cache size limits).

## 10. Helper Functions

### 10.1 When to Create

Create helper functions when:
- Setup logic is reused across 2+ tests.
- A test requires constructing a complex object (e.g., `PluginInput`, `ToolContext`).
- A test invokes a function with default parameters that are cumbersome to type repeatedly.

### 10.2 Naming

- Helper names should be verbs: `setupDefaultMocks`, `makeMockSubprocess`, `callGetInstallationToken`.
- Private helpers (used by only one `describe` block) go inside that block.
- Module-level helpers go before the first `describe` block with a comment separator.

### 10.3 Factory Functions

Use factory functions for complex objects with optional overrides:

```ts
function makePluginInput(overrides: Partial<PluginInput> = {}): PluginInput {
  return {
    client: {} as any,
    project: { id: 'test', name: 'test', directory: '/tmp' } as any,
    ...overrides,
  };
}
```

## 11. Comment Style

- Use minimal comments. Code should be self-documenting.
- Use section separators for clarity:

```ts
// ---------------------------------------------------------------------------
// Mock functions
// ---------------------------------------------------------------------------
```

- Document mock chains briefly: `// Wire up: App → getInstallationOctokit → auth`
- Do NOT add JSDoc to test helpers unless the logic is non-obvious.

## 12. Anti-Patterns (Avoid)

- **Async leaks**: No floating promises. Always `await` all calls to prevent tasks from leaking between tests.
- **Test leakage**: Violating the Shared-Nothing Principle (Section 7.1) by allowing state to bleed between tests. Clear all mocks and env vars between tests.
- **Over-mocking**: Do not mock modules that are not external dependencies. Test the real implementation when possible.
- **Testing implementation details**: Test public behavior, not internal state or private method calls.
- **Bundled assertions**: Do not put 10+ unrelated assertions in a single `it` block. Split into separate tests.
- **Magic numbers in tests**: Extract timeout values, retry counts, and buffer durations into named constants or document them inline.
- **Testing private APIs**: Do not test `#privateMethod` or internal functions. Test through the public interface.
- **Snapshot tests**: This project does not use snapshots. Use explicit assertions.
