# Testing Patterns

**Analysis Date:** 2026-02-14

## Test Framework Status

**Testing Infrastructure:** Not detected

**Current State:**
- No test runner configured (Jest, Vitest, Mocha, etc.)
- No test files present
- No test configuration files (`jest.config.ts`, `vitest.config.ts`, etc.)
- No test dependencies in `package.json`

**Development Dependencies:**
- `@types/node`: ^25.0.10 (type definitions only)
- `style-dictionary`: ^5.2.0 (core framework)
- `style-dictionary-utils`: ^6.0.1 (SDK)
- `tsx`: ^4.0.0 (TypeScript execution)

## Test Organization

**Current structure:**
- No `test/`, `tests/`, `__tests__/`, or `*.test.ts` / `*.spec.ts` files exist
- No test fixtures or mock data files

**Expected locations if tests were added:**
- Unit tests: Co-located with source or `tests/unit/` directory
- Integration tests: `tests/integration/` directory
- Token validation tests: `tests/tokens/` directory (for validating token JSON structures)

## Build Script Characteristics

The only runnable code is `scripts/buildTokens.ts`, which orchestrates token builds but lacks automated validation:

**Script entry point:** `scripts/buildTokens.ts`

**Current validation:**
```typescript
try {
  rmSync("./dist", { recursive: true, force: true })
} catch {
  // Directory doesn't exist, that's fine
}
```
- Only checks for directory existence
- No token structure validation
- No output validation

**Build phases:**
1. Clean dist directory
2. Build base tokens (light mode + default radius)
3. Build dark mode semantic tokens
4. Build radius variant modes (sharp, rounded, pill)
5. Log completion to console

**Potential testing areas (currently untested):**
- Token file structure validation (DTCG format compliance)
- Token reference resolution (curly brace syntax correctness)
- CSS output validation (correct selector application, variable generation)
- Collection inclusion/exclusion logic (primitives vs source tokens)
- Mode-specific token output (light/dark mode correctness)
- Dimension unit conversion (`rem` output with `basePxFontSize: 16`)
- Color output format (hex conversion from sRGB components)
- File system cleanup before builds

## Recommended Testing Approach

**If testing infrastructure is added, follow these patterns:**

### Token Validation Tests

**Structure:**
```typescript
describe("Token Structure", () => {
  it("should load all token files without syntax errors", () => {
    // Parse each .tokens.json file and validate JSON structure
  })

  it("should validate DTCG format compliance", () => {
    // Check $type and $value properties exist
    // Validate types match Style Dictionary spec
  })

  it("should resolve all token references", () => {
    // Parse curly brace {token-name} references
    // Verify referenced tokens exist
  })
})
```

### Build Output Tests

**Structure:**
```typescript
describe("CSS Build Output", () => {
  it("should generate base.css with light mode colors", () => {
    // Run build, check dist/css/base.css exists
    // Validate CSS custom properties format
  })

  it("should generate theme-dark.css with dark selector", () => {
    // Verify [data-theme="dark"] selector in output
    // Check dark mode colors present
  })

  it("should generate radius variant files", () => {
    // Check radius-sharp.css, radius-rounded.css, etc.
    // Verify correct selectors: [data-radius="sharp"], etc.
  })
})
```

### Integration Tests

**Structure:**
```typescript
describe("Build Pipeline", () => {
  beforeEach(() => {
    // Clean dist directory
  })

  afterEach(() => {
    // Cleanup generated files
  })

  it("should build all outputs in sequence", async () => {
    // Execute buildTokens.ts
    // Verify all expected CSS files created
    // Check file contents for validity
  })

  it("should handle missing token files gracefully", () => {
    // Test error handling when token file is missing
  })
})
```

### Fixture Organization

**If implemented, place test data in:**
- `tests/fixtures/tokens/` - Sample token files for testing
- `tests/fixtures/expected/` - Expected CSS output for assertions

**Example fixture structure:**
```
tests/
├── fixtures/
│   ├── tokens/
│   │   ├── valid-color.tokens.json
│   │   ├── invalid-references.tokens.json
│   │   └── incomplete-dtcg.tokens.json
│   └── expected/
│       ├── base.css
│       └── theme-dark.css
├── unit/
│   └── token-validation.test.ts
└── integration/
    └── build-pipeline.test.ts
```

## Manual Validation Process

**Current approach (without automated tests):**

1. **Build execution:**
   ```bash
   npm run build:tokens
   ```

2. **Output verification:**
   - Check `dist/css/` directory exists
   - Verify files created: `base.css`, `theme-dark.css`, `radius-*.css`
   - Inspect CSS content for valid variable syntax

3. **Token validation:**
   - Manually inspect `.tokens.json` files in `src/tokens/`
   - Verify DTCG format: `$type` and `$value` properties
   - Check reference syntax: `{token-name}` format

4. **Reference validation:**
   - Trace token references through files
   - Verify primitives are defined before semantic tokens reference them

## Coverage Gaps

**Critical areas lacking automation:**

| Area | What's Not Tested | Risk |
|------|------------------|------|
| Token structure | DTCG format compliance | Invalid token files silently fail |
| Reference resolution | Curly brace syntax, token existence | Build succeeds with broken references |
| CSS output | Selector correctness, variable format | Invalid CSS generated |
| Collection logic | Include vs source distinction | Wrong tokens included in output |
| Mode switching | Light/dark/radius mode application | Incorrect CSS selectors |
| Unit conversion | rem output with px input | Wrong dimension values |
| Build reliability | Directory cleanup, file writing | Orphaned files, stale outputs |

## Run Commands (When Testing Implemented)

```bash
# Example commands if test framework added:
npm test                    # Run all tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report
npm run build:tokens       # Current build command (no test integration)
```

**Note:** No test commands currently configured in `package.json`

---

*Testing analysis: 2026-02-14*
