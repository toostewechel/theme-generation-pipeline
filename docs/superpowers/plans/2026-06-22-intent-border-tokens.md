# Intent Border Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-intent border tokens (`color-border-{success,error,warning,info,neutral}` solid + `-subtle`) for light and dark modes to the color engine, then regenerate the pipeline and sync the CSS to the snapshotlabs site.

**Architecture:** Pure data addition to the two kept-token tables in `src/engine/semantics.ts` using the existing `ref(ramp, step)` helper — no new code paths. Tokens flow through the existing `resolveSemantics → buildSemanticDtcg → Style Dictionary → dist/css/tokens.css` pipeline unchanged. Then a regeneration/sync task copies the output into the snapshotlabs repo.

**Tech Stack:** TypeScript (ESM, `.js` import specifiers), vitest, Style Dictionary, culori.

## Global Constraints

- Each new token is `ref("<ramp>", "<step>")` — no new helper, type, primitive, or module.
- Every token MUST be added to BOTH `KEEP_LIGHT` and `KEEP_DARK`; the parity guard (`src/engine/semantics.test.ts:46-58`) fails otherwise.
- `ref(ramp, step)` returns `{ kind: "ref", ramp, step }`.
- Exact step mapping (verbatim from the spec):

  | Token | Light | Dark |
  |---|---|---|
  | `color-border-success` | `ref("success","600")` | `ref("success","400")` |
  | `color-border-success-subtle` | `ref("success","200")` | `ref("success","800")` |
  | `color-border-error` | `ref("error","600")` | `ref("error","400")` |
  | `color-border-error-subtle` | `ref("error","200")` | `ref("error","800")` |
  | `color-border-warning` | `ref("warning","600")` | `ref("warning","400")` |
  | `color-border-warning-subtle` | `ref("warning","200")` | `ref("warning","800")` |
  | `color-border-info` | `ref("info","600")` | `ref("info","400")` |
  | `color-border-info-subtle` | `ref("info","200")` | `ref("info","800")` |
  | `color-border-neutral` | `ref("neutral","300")` | `ref("neutral","700")` |
  | `color-border-neutral-subtle` | `ref("neutral","200")` | `ref("neutral","800")` |

- ESM with explicit `.js` import specifiers.
- snapshotlabs target: `~/Documents/GitHub/snapshotlabs/site/src/styles/_tokens.scss` (branch `feat/lean-token-migration`). Do NOT commit in the snapshotlabs repo — file copy only.

---

### Task 1: Add intent border tokens to the semantic tables

Add the 10 tokens to both kept-token tables with their per-mode steps, and pin the mapping with a focused test.

**Files:**
- Modify: `src/engine/semantics.ts` — `KEEP_LIGHT` (after `color-border-brand-secondary`, currently line 174) and `KEEP_DARK` (after `color-border-brand-secondary`, currently line 218)
- Test: `src/engine/semantics.test.ts` (add one `describe` block)

**Interfaces:**
- Consumes: `ref(ramp, step) => { kind: "ref", ramp, step }` (already defined, `src/engine/semantics.ts:34`); `SEMANTICS_LIGHT`, `SEMANTICS_DARK` exports.
- Produces: 10 new keys present in both `SEMANTICS_LIGHT` and `SEMANTICS_DARK`, each a `RefSpec`. Consumed downstream by `buildSemanticDtcg` (no change needed) and Task 2's regeneration.

- [ ] **Step 1: Write the failing test**

Append to `src/engine/semantics.test.ts`:

```ts
describe("intent border tokens", () => {
  const expected = {
    "color-border-success":        { light: ["success", "600"], dark: ["success", "400"] },
    "color-border-success-subtle": { light: ["success", "200"], dark: ["success", "800"] },
    "color-border-error":          { light: ["error", "600"],   dark: ["error", "400"] },
    "color-border-error-subtle":   { light: ["error", "200"],   dark: ["error", "800"] },
    "color-border-warning":        { light: ["warning", "600"], dark: ["warning", "400"] },
    "color-border-warning-subtle": { light: ["warning", "200"], dark: ["warning", "800"] },
    "color-border-info":           { light: ["info", "600"],    dark: ["info", "400"] },
    "color-border-info-subtle":    { light: ["info", "200"],    dark: ["info", "800"] },
    "color-border-neutral":        { light: ["neutral", "300"], dark: ["neutral", "700"] },
    "color-border-neutral-subtle": { light: ["neutral", "200"], dark: ["neutral", "800"] },
  } as const;

  for (const [name, m] of Object.entries(expected)) {
    it(`${name} maps to the expected ramp/step in both modes`, () => {
      expect(SEMANTICS_LIGHT[name]).toEqual({ kind: "ref", ramp: m.light[0], step: m.light[1] });
      expect(SEMANTICS_DARK[name]).toEqual({ kind: "ref", ramp: m.dark[0], step: m.dark[1] });
    });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- semantics`
Expected: FAIL — the new `color-border-*` keys are `undefined` in both tables (`expected {…} to equal { kind: "ref", … }` mismatches).

- [ ] **Step 3: Add the tokens to `KEEP_LIGHT`**

In `src/engine/semantics.ts`, immediately after the `"color-border-brand-secondary": ref("accent", "100"),` line in `KEEP_LIGHT` (currently line 174), insert:

```ts
  "color-border-success": ref("success", "600"),
  "color-border-success-subtle": ref("success", "200"),
  "color-border-error": ref("error", "600"),
  "color-border-error-subtle": ref("error", "200"),
  "color-border-warning": ref("warning", "600"),
  "color-border-warning-subtle": ref("warning", "200"),
  "color-border-info": ref("info", "600"),
  "color-border-info-subtle": ref("info", "200"),
  "color-border-neutral": ref("neutral", "300"),
  "color-border-neutral-subtle": ref("neutral", "200"),
```

- [ ] **Step 4: Add the tokens to `KEEP_DARK`**

In `src/engine/semantics.ts`, immediately after the `"color-border-brand-secondary": ref("accent", "700"),` line in `KEEP_DARK` (currently line 218), insert:

```ts
  "color-border-success": ref("success", "400"),
  "color-border-success-subtle": ref("success", "800"),
  "color-border-error": ref("error", "400"),
  "color-border-error-subtle": ref("error", "800"),
  "color-border-warning": ref("warning", "400"),
  "color-border-warning-subtle": ref("warning", "800"),
  "color-border-info": ref("info", "400"),
  "color-border-info-subtle": ref("info", "800"),
  "color-border-neutral": ref("neutral", "700"),
  "color-border-neutral-subtle": ref("neutral", "800"),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- semantics`
Expected: PASS — all 10 new mapping tests pass AND the existing parity guard ("light/dark define the same keys") stays green.

- [ ] **Step 6: Run the full suite**

Run: `npm test`
Expected: PASS — no regressions across the engine suite.

- [ ] **Step 7: Commit**

```bash
git add src/engine/semantics.ts src/engine/semantics.test.ts
git commit -m "feat(engine): add per-intent border tokens (solid + subtle, light/dark)"
```

---

### Task 2: Regenerate the pipeline and sync to snapshotlabs

Regenerate the token JSON + CSS, confirm the new border tokens appear, and copy the CSS into the snapshotlabs site.

**Files:**
- Modify (regenerated): `src/tokens/color.light.tokens.json`, `src/tokens/color.dark.tokens.json`
- Generated (gitignored, not committed): `dist/css/tokens.css`
- Sync target (different repo, not committed): `~/Documents/GitHub/snapshotlabs/site/src/styles/_tokens.scss`

**Interfaces:**
- Consumes: the 10 new tokens added to the semantic tables in Task 1.
- Produces: regenerated token files containing `"color-border-success": { "$type": "color", "$value": "{color-success-600}" }` (light) etc.

- [ ] **Step 1: Regenerate token JSON**

Run: `npm run build:theme`
Expected: prints `✅ src/tokens/color.light.tokens.json` and `✅ src/tokens/color.dark.tokens.json`.

- [ ] **Step 2: Verify the new refs landed in the JSON**

Run: `grep -c "color-border-success\|color-border-neutral-subtle" src/tokens/color.light.tokens.json src/tokens/color.dark.tokens.json`
Expected: each file reports `2` (both names present). Also spot-check the values:
Run: `grep -A1 '"color-border-success"' src/tokens/color.light.tokens.json`
Expected: `"$value": "{color-success-600}"`.

- [ ] **Step 3: Build the CSS**

Run: `npm run build:tokens`
Expected: `🎉 Build completed successfully` and `✅ dist/css/tokens.css`.

- [ ] **Step 4: Verify the CSS contains the new custom properties (light + dark)**

Run: `grep -c "color-border-success\|color-border-neutral-subtle" dist/css/tokens.css`
Expected: `4` (2 names × light + dark blocks). Spot-check:
Run: `grep "\-\-color-border-success:" dist/css/tokens.css`
Expected: light block → `--color-border-success: var(--color-success-600);` and dark block → `var(--color-success-400);`.

- [ ] **Step 5: Commit the regenerated token JSON**

```bash
git add src/tokens/color.light.tokens.json src/tokens/color.dark.tokens.json
git commit -m "chore(tokens): regenerate with intent border tokens"
```

- [ ] **Step 6: Sync the CSS into snapshotlabs**

Run:
```bash
cp dist/css/tokens.css ~/Documents/GitHub/snapshotlabs/site/src/styles/_tokens.scss
```

- [ ] **Step 7: Verify the sync added only the new border tokens**

Run:
```bash
cd ~/Documents/GitHub/snapshotlabs && git diff --stat site/src/styles/_tokens.scss && git diff site/src/styles/_tokens.scss | grep '^+' | grep -c 'color-border-'
```
Expected: the only added lines are `--color-border-{success,error,warning,info,neutral}[-subtle]` (the grep count is `20` — 10 names × light + dark). No unrelated lines removed/changed. Do NOT commit in the snapshotlabs repo — leave the change for the user to review and commit there.

- [ ] **Step 8: Report the snapshotlabs diff**

Report the `git diff --stat` and the list of added `--color-border-*` lines so the user can review before committing in snapshotlabs.

---

## Notes for the implementer

- This is a pure data addition. If `build:theme` changes anything in `primitives-color.mode-1.tokens.json` (it should not — no new primitives), stop and investigate; only the two `color.*.tokens.json` files should change.
- The snapshotlabs repo is a SEPARATE git repo on branch `feat/lean-token-migration`. The only action there is the file copy in Step 6; never run `git commit`/`git push` in it.
