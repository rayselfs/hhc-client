# LiquidSelect Component Implementation

## TL;DR

> **Quick Summary**: Create a Vuetify v-select wrapper with Liquid Glass styling, supporting single/multiple selection, search, and full glass dropdown menu.
>
> **Deliverables**:
>
> - `LiquidSelect.vue` - Main component with glass styling
> - `_liquid-select-menu.scss` - Global dropdown menu styles
> - Updated `plugin.ts` and `index.ts` exports
>
> **Estimated Effort**: Medium (4-6 hours)
> **Parallel Execution**: NO - sequential (each task builds on previous)
> **Critical Path**: Task 1 (structure) -> Task 2 (glass styling) -> Task 3 (dropdown) -> Task 4 (multiple/chips) -> Task 5 (search/clear) -> Task 6 (register)

---

## Context

### Original Request

Create a Liquid Glass styled v-select component following the existing LiquidGlass design system patterns.

### Interview Summary

**Key Discussions**:

- **Implementation approach**: User explicitly chose to wrap Vuetify v-select (not build from primitives)
- **Features**: Single/multiple selection, chips, searchable, clearable, custom item slots, loading state
- **Variants**: `glass` (default) and `tinted` only
- **Dropdown style**: Full glass effect with LiquidListItem for options

**Research Findings**:

- Vuetify v-select key slots: `item`, `chip`, `selection`, `prepend-item`, `append-item`, `no-data`
- Override strategy: Use `menu-props.contentClass` for dropdown + global SCSS
- LiquidGlass pattern: 3-layer structure (`__glass-effect`, `__glass-tint`, `__glass-shine`)

### Metis Review

**Identified Gaps** (addressed):

- **Architectural deviation**: Other LiquidGlass components use native elements, not Vuetify wrappers. DECISION: Proceed with wrapping as user requested, document as intentional deviation.
- **Multiple selection display**: Default to horizontal scroll for chips
- **Dropdown blur performance**: Use `--hhc-blur-lg` (16px) instead of `--hhc-blur-xl` (20px)
- **Edge cases**: Added explicit handling for empty state, loading, disabled options

---

## Work Objectives

### Core Objective

Create `LiquidSelect` - a drop-in replacement for `v-select` with Liquid Glass visual styling while preserving all Vuetify functionality.

### Concrete Deliverables

- `src/components/LiquidGlass/LiquidSelect/LiquidSelect.vue`
- `src/components/LiquidGlass/LiquidSelect/index.ts`
- `src/components/LiquidGlass/styles/_liquid-select-menu.scss`
- Updated `src/components/LiquidGlass/plugin.ts`
- Updated `src/components/LiquidGlass/index.ts`

### Definition of Done

- [x] `npm run type-check` passes with no errors
- [x] Component renders with glass effect in both variants
- [x] Dropdown menu displays with glass styling
- [x] Single and multiple selection work correctly
- [x] Searchable filter works
- [x] Clearable button works
- [x] Custom item slot with LiquidListItem works

### Must Have

- 3-layer glass structure matching LiquidTextField pattern
- `glass` and `tinted` variants
- Props: `modelValue`, `items`, `itemTitle`, `itemValue`, `multiple`, `chips`, `closableChips`, `clearable`, `searchable`, `disabled`, `loading`, `placeholder`
- Slot pass-through for customization
- Full glass dropdown menu styling

### Must NOT Have (Guardrails)

- NO `solid`, `outlined`, `elevated` variants (only `glass`, `tinted`)
- NO custom size scale (use existing `SIZE_SCALE` from constants)
- NO combobox/autocomplete free-text entry
- NO server-side async filtering logic
- NO option grouping (defer to v2)
- NO form validation rules display (use `hide-details` by default)
- NO custom animations beyond Vuetify defaults

---

## Verification Strategy (MANDATORY)

### Test Decision

- **Infrastructure exists**: YES (Vitest)
- **User wants tests**: Manual verification (no explicit test requirement stated)
- **Framework**: Vitest for unit tests if added
- **QA approach**: Manual verification with executable commands

### Verification Protocol

All verification is **agent-executable** - no user intervention required.

**TypeScript Verification**:

```bash
npm run type-check
# Assert: Exit code 0, no errors in LiquidSelect files
```

**Lint Verification**:

```bash
npm run lint
# Assert: Exit code 0, no errors in LiquidSelect files
```

**Build Verification**:

```bash
npm run build
# Assert: Exit code 0, build completes successfully
```

**Visual Verification** (Playwright via dev server):

```
# Start dev server first: npm run dev
# Playwright actions:
1. Navigate to app and import LiquidSelect in a test view
2. Click on LiquidSelect trigger
3. Assert: Dropdown menu is visible with glass styling
4. Screenshot: Save to .sisyphus/evidence/liquid-select-dropdown.png
```

---

## Execution Strategy

### Sequential Execution

This plan requires sequential execution as each task builds on the previous:

```
Task 1: Create file structure and basic component shell
    │
    ▼
Task 2: Implement glass layers and trigger styling
    │
    ▼
Task 3: Style dropdown menu with global SCSS
    │
    ▼
Task 4: Implement multiple selection with LiquidChip
    │
    ▼
Task 5: Add searchable and clearable features
    │
    ▼
Task 6: Register component and update exports
```

### Dependency Matrix

| Task | Depends On | Blocks        |
| ---- | ---------- | ------------- |
| 1    | None       | 2, 3, 4, 5, 6 |
| 2    | 1          | 3, 4, 5       |
| 3    | 2          | 4, 5          |
| 4    | 3          | 5             |
| 5    | 4          | 6             |
| 6    | 5          | None          |

---

## TODOs

- [x] 1. Create LiquidSelect file structure and basic component shell

  **What to do**:
  - Create directory `src/components/LiquidGlass/LiquidSelect/`
  - Create `LiquidSelect.vue` with basic template wrapping `v-select`
  - Create `index.ts` barrel export
  - Define TypeScript props interface with all required props
  - Set up `useLiquidGlassFilters()` composable call

  **Must NOT do**:
  - Do not add glass styling yet (Task 2)
  - Do not style dropdown (Task 3)
  - Do not implement multiple selection chips (Task 4)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: File scaffolding with known patterns
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Component structure knowledge

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Tasks 2, 3, 4, 5, 6
  - **Blocked By**: None (can start immediately)

  **References**:

  **Pattern References**:
  - `src/components/LiquidGlass/LiquidTextField/LiquidTextField.vue:51-91` - Props interface pattern with `withDefaults`
  - `src/components/LiquidGlass/LiquidBtn/LiquidBtn.vue:66-141` - Comprehensive props definition with JSDoc
  - `src/components/LiquidGlass/LiquidTextField/index.ts` - Barrel export pattern (single line)

  **Type References**:
  - `src/components/LiquidGlass/constants/sizes.ts:9` - `SizeKey` type for size prop
  - `src/components/LiquidGlass/constants/colors.ts:9` - `ThemeColor` type for color prop

  **Composable References**:
  - `src/components/LiquidGlass/composables/useLiquidGlassFilters.ts:42-46` - Must call in setup

  **v-select Usage Reference**:
  - `src/components/Bible/Selector/VersionSelector.vue:4-21` - How v-select is currently used with props

  **Acceptance Criteria**:

  ```bash
  # File exists verification
  ls -la src/components/LiquidGlass/LiquidSelect/
  # Assert: Shows LiquidSelect.vue and index.ts

  # TypeScript compilation check
  npm run type-check 2>&1 | grep -E "(LiquidSelect|error)"
  # Assert: No type errors mentioning LiquidSelect

  # Component can be imported
  node -e "console.log('import check')" && echo "// Test import" | cat
  # Manual verification: Component should export from index.ts
  ```

  **Commit**: YES
  - Message: `feat(liquid-glass): scaffold LiquidSelect component structure`
  - Files: `src/components/LiquidGlass/LiquidSelect/*`
  - Pre-commit: `npm run type-check`

---

- [x] 2. Implement glass layers and trigger styling

  **What to do**:
  - Add 3-layer glass structure to template (`__glass-effect`, `__glass-tint`, `__glass-shine`)
  - Implement `glass` and `tinted` variants
  - Override Vuetify's default v-field styling with `:deep()` selectors
  - Add focused state styling (border glow like LiquidTextField)
  - Add disabled state styling using `liquid-disabled` mixin
  - Implement size prop using `SIZE_SCALE` constants

  **Must NOT do**:
  - Do not implement dropdown menu styling (Task 3)
  - Do not add custom size values outside SIZE_SCALE
  - Do not add variants beyond `glass` and `tinted`

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: CSS styling and visual implementation
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Glass effect styling expertise

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 1)
  - **Blocks**: Tasks 3, 4, 5
  - **Blocked By**: Task 1

  **References**:

  **Pattern References**:
  - `src/components/LiquidGlass/LiquidTextField/LiquidTextField.vue:10-14` - 3-layer glass structure template
  - `src/components/LiquidGlass/LiquidTextField/LiquidTextField.vue:146-184` - Glass layer SCSS with focus state
  - `src/components/LiquidGlass/LiquidBtn/LiquidBtn.vue:232-252` - Tint style computed property for color

  **Mixin References**:
  - `src/components/LiquidGlass/styles/_mixins.scss:46-49` - `liquid-glass-backdrop()` mixin
  - `src/components/LiquidGlass/styles/_mixins.scss:55-57` - `liquid-glass-tint()` mixin
  - `src/components/LiquidGlass/styles/_mixins.scss:12-23` - `liquid-glass-pill-shadow()` mixin
  - `src/components/LiquidGlass/styles/_mixins.scss:157-161` - `liquid-disabled` mixin

  **Size References**:
  - `src/components/LiquidGlass/constants/sizes.ts:29-60` - SIZE_SCALE definition
  - `src/components/LiquidGlass/constants/sizes.ts:93-108` - `getSizeConfig()` function

  **CSS Override Reference**:
  - Vuetify classes to override: `.v-field`, `.v-field__overlay`, `.v-field__outline`
  - Use `:deep(.v-field) { background: transparent !important; }` pattern

  **Acceptance Criteria**:

  ```bash
  # TypeScript check
  npm run type-check
  # Assert: Exit code 0

  # Lint check
  npm run lint -- --ext .vue src/components/LiquidGlass/LiquidSelect/
  # Assert: No errors

  # SCSS mixin usage verification
  grep -n "liquid-glass-backdrop\|liquid-glass-tint\|liquid-glass-pill-shadow" src/components/LiquidGlass/LiquidSelect/LiquidSelect.vue
  # Assert: Shows line numbers where mixins are used
  ```

  **Visual Verification** (Playwright):

  ```
  1. Navigate to dev app with LiquidSelect rendered
  2. Assert: Glass blur effect visible on trigger
  3. Click to focus LiquidSelect
  4. Assert: Focus ring/glow appears
  5. Screenshot: .sisyphus/evidence/liquid-select-trigger.png
  ```

  **Commit**: YES
  - Message: `feat(liquid-glass): add glass layer styling to LiquidSelect trigger`
  - Files: `src/components/LiquidGlass/LiquidSelect/LiquidSelect.vue`
  - Pre-commit: `npm run type-check && npm run lint`

---

- [x] 3. Style dropdown menu with global SCSS

  **What to do**:
  - Create `src/components/LiquidGlass/styles/_liquid-select-menu.scss`
  - Add glass backdrop-filter, tint, border, and shadow to dropdown menu
  - Style `.v-list` inside dropdown (transparent background, padding)
  - Import new SCSS file in `_index.scss`
  - Configure `menu-props` in component to apply custom class

  **Must NOT do**:
  - Do not use scoped styles for dropdown (won't work - dropdown renders in portal)
  - Do not add excessive blur (use `--hhc-blur-lg` for performance)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Global SCSS for portal-rendered dropdown
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: CSS architecture for component libraries

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 2)
  - **Blocks**: Tasks 4, 5
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - `src/components/LiquidGlass/LiquidContainer/LiquidContainer.vue:53-99` - Glass container styling (similar effect for dropdown)
  - `src/components/Bible/Selector/VersionSelector.vue:15` - `menu-props` usage pattern

  **SCSS Import Reference**:
  - `src/components/LiquidGlass/styles/_index.scss` - Where to add import

  **Mixin References**:
  - `src/components/LiquidGlass/styles/_mixins.scss:46-49` - `liquid-glass-backdrop()` for blur
  - `src/components/LiquidGlass/styles/_mixins.scss:63-65` - `liquid-glass-tint-dark()` for darker menu background

  **CSS Variables Reference**:
  - `--hhc-blur-lg` (16px) - Use this for dropdown blur (not xl for performance)
  - `--hhc-glass-tint-dark` - Darker background for dropdown
  - `--hhc-glass-border` - Border color
  - `--hhc-glass-shadow-color` - Shadow color

  **Target CSS Classes**:
  - `.liquid-select-menu` - Custom class applied via menu-props
  - `.liquid-select-menu .v-list` - List container inside dropdown
  - `.liquid-select-menu .v-list-item` - Default item styling (before LiquidListItem override)

  **Acceptance Criteria**:

  ```bash
  # File exists
  ls src/components/LiquidGlass/styles/_liquid-select-menu.scss
  # Assert: File exists

  # Import added to index
  grep "liquid-select-menu" src/components/LiquidGlass/styles/_index.scss
  # Assert: Shows @use or @forward statement

  # Build still works
  npm run build
  # Assert: Exit code 0
  ```

  **Visual Verification** (Playwright):

  ```
  1. Navigate to dev app with LiquidSelect
  2. Click to open dropdown
  3. Assert: Dropdown has glass blur effect
  4. Assert: Dropdown has rounded corners (16px radius)
  5. Screenshot: .sisyphus/evidence/liquid-select-menu.png
  ```

  **Commit**: YES
  - Message: `feat(liquid-glass): add glass dropdown menu styling for LiquidSelect`
  - Files: `src/components/LiquidGlass/styles/_liquid-select-menu.scss`, `src/components/LiquidGlass/styles/_index.scss`
  - Pre-commit: `npm run build`

---

- [x] 4. Implement multiple selection with LiquidChip

  **What to do**:
  - Override `#chip` slot to render `LiquidChip` instead of `v-chip`
  - Pass through `closable` prop when `closableChips` is true
  - Handle chip close event to remove item from selection
  - Style chip container for horizontal scroll when many chips
  - Override `#item` slot to render `LiquidListItem` for dropdown options

  **Must NOT do**:
  - Do not create custom chip component (use existing LiquidChip)
  - Do not implement virtual scrolling for many items (defer to v2)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Component composition and slot handling
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Vue slot patterns and component composition

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 3)
  - **Blocks**: Task 5
  - **Blocked By**: Task 3

  **References**:

  **Pattern References**:
  - `src/components/LiquidGlass/LiquidChip/LiquidChip.vue:62-89` - LiquidChip props (variant, size, closable)
  - `src/components/LiquidGlass/LiquidListItem/LiquidListItem.vue:47-126` - LiquidListItem props (selected, color, hoverOpacity)

  **Vuetify Slot Reference** (from source analysis):
  - `#chip="{ item, index, props }"` - Chip slot signature
  - `#item="{ item, index, props }"` - Item slot signature
  - Must use `v-bind="props"` to preserve click handlers

  **Event Handling Reference**:
  - `src/components/LiquidGlass/LiquidListItem/LiquidListItem.vue:225-238` - Click event handling pattern

  **Selection Check Pattern**:

  ```typescript
  const isSelected = (item) => {
    if (props.multiple) {
      return model.value.some((s) => s.value === item.value)
    }
    return model.value?.[0]?.value === item.value
  }
  ```

  **Acceptance Criteria**:

  ```bash
  # TypeScript check
  npm run type-check
  # Assert: Exit code 0

  # LiquidChip import exists
  grep -n "LiquidChip" src/components/LiquidGlass/LiquidSelect/LiquidSelect.vue
  # Assert: Shows import and usage

  # LiquidListItem import exists
  grep -n "LiquidListItem" src/components/LiquidGlass/LiquidSelect/LiquidSelect.vue
  # Assert: Shows import and usage
  ```

  **Visual Verification** (Playwright):

  ```
  1. Navigate to dev app with LiquidSelect (multiple=true, chips=true)
  2. Select 3 items
  3. Assert: 3 LiquidChips visible in trigger
  4. Click close button on one chip
  5. Assert: 2 chips remain
  6. Screenshot: .sisyphus/evidence/liquid-select-chips.png
  ```

  **Commit**: YES
  - Message: `feat(liquid-glass): implement multiple selection with LiquidChip and LiquidListItem`
  - Files: `src/components/LiquidGlass/LiquidSelect/LiquidSelect.vue`
  - Pre-commit: `npm run type-check`

---

- [x] 5. Add searchable and clearable features

  **What to do**:
  - Add `clearable` prop and clear icon styling
  - Ensure search/filter functionality works (v-select built-in)
  - Add loading state with `LiquidProgressCircular` via `#loader` slot
  - Add empty state handling via `#no-data` slot
  - Style the search input within dropdown if applicable

  **Must NOT do**:
  - Do not implement server-side filtering
  - Do not add debouncing (use v-select's built-in behavior)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Prop additions and slot overrides
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Component feature completion

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after Task 4)
  - **Blocks**: Task 6
  - **Blocked By**: Task 4

  **References**:

  **Pattern References**:
  - `src/components/LiquidGlass/LiquidProgressCircular/LiquidProgressCircular.vue` - Loading spinner component
  - `src/components/LiquidGlass/LiquidTextField/LiquidTextField.vue:42-46` - Append slot pattern for icons

  **Clear Icon Styling**:
  - Use `mdi-close-circle` icon
  - Style with `rgba(var(--hhc-glass-text), 0.5)` default, `0.8` on hover

  **v-select Props Reference**:
  - `clearable` - Shows clear button
  - `:loading` - Shows loading state
  - `no-filter` - Disable filtering (if needed)

  **Acceptance Criteria**:

  ```bash
  # TypeScript check
  npm run type-check
  # Assert: Exit code 0

  # Clearable prop exists
  grep -n "clearable" src/components/LiquidGlass/LiquidSelect/LiquidSelect.vue | head -5
  # Assert: Shows prop definition and usage

  # Loading import
  grep -n "LiquidProgressCircular" src/components/LiquidGlass/LiquidSelect/LiquidSelect.vue
  # Assert: Shows import
  ```

  **Visual Verification** (Playwright):

  ```
  1. Navigate to dev app with LiquidSelect (clearable=true)
  2. Select an item
  3. Assert: Clear icon visible
  4. Click clear icon
  5. Assert: Selection cleared
  6. Set loading=true
  7. Assert: Spinner visible in dropdown
  8. Screenshot: .sisyphus/evidence/liquid-select-clear-loading.png
  ```

  **Commit**: YES
  - Message: `feat(liquid-glass): add clearable and loading features to LiquidSelect`
  - Files: `src/components/LiquidGlass/LiquidSelect/LiquidSelect.vue`
  - Pre-commit: `npm run type-check`

---

- [x] 6. Register component and update exports

  **What to do**:
  - Import `LiquidSelect` in `plugin.ts` and register with `app.component()`
  - Export `LiquidSelect` from `index.ts` barrel file
  - Verify all exports work correctly
  - Run full type-check and lint

  **Must NOT do**:
  - Do not add to any existing views/components yet (separate task)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple file edits following existing patterns
  - **Skills**: []
    - No special skills needed

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final task)
  - **Blocks**: None (final)
  - **Blocked By**: Task 5

  **References**:

  **Pattern References**:
  - `src/components/LiquidGlass/plugin.ts:6-18` - Import pattern for components
  - `src/components/LiquidGlass/plugin.ts:37-52` - Registration pattern in install()
  - `src/components/LiquidGlass/index.ts:2-14` - Export pattern

  **Exact Lines to Modify**:
  - `plugin.ts` line ~18: Add `import { LiquidSelect } from './LiquidSelect'`
  - `plugin.ts` line ~52: Add `app.component('LiquidSelect', LiquidSelect)`
  - `index.ts` line ~14: Add `export * from './LiquidSelect'`

  **Acceptance Criteria**:

  ```bash
  # Plugin has import and registration
  grep -n "LiquidSelect" src/components/LiquidGlass/plugin.ts
  # Assert: Shows import line AND app.component() line

  # Index exports
  grep -n "LiquidSelect" src/components/LiquidGlass/index.ts
  # Assert: Shows export statement

  # Full type check
  npm run type-check
  # Assert: Exit code 0

  # Full lint
  npm run lint
  # Assert: Exit code 0

  # Build succeeds
  npm run build
  # Assert: Exit code 0
  ```

  **Commit**: YES
  - Message: `feat(liquid-glass): register LiquidSelect in plugin and exports`
  - Files: `src/components/LiquidGlass/plugin.ts`, `src/components/LiquidGlass/index.ts`
  - Pre-commit: `npm run type-check && npm run lint && npm run build`

---

## Commit Strategy

| After Task | Message                                                                               | Files                                                   | Verification                                          |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------- |
| 1          | `feat(liquid-glass): scaffold LiquidSelect component structure`                       | `LiquidSelect/*`                                        | `npm run type-check`                                  |
| 2          | `feat(liquid-glass): add glass layer styling to LiquidSelect trigger`                 | `LiquidSelect.vue`                                      | `npm run type-check && npm run lint`                  |
| 3          | `feat(liquid-glass): add glass dropdown menu styling for LiquidSelect`                | `styles/_liquid-select-menu.scss`, `styles/_index.scss` | `npm run build`                                       |
| 4          | `feat(liquid-glass): implement multiple selection with LiquidChip and LiquidListItem` | `LiquidSelect.vue`                                      | `npm run type-check`                                  |
| 5          | `feat(liquid-glass): add clearable and loading features to LiquidSelect`              | `LiquidSelect.vue`                                      | `npm run type-check`                                  |
| 6          | `feat(liquid-glass): register LiquidSelect in plugin and exports`                     | `plugin.ts`, `index.ts`                                 | `npm run type-check && npm run lint && npm run build` |

---

## Success Criteria

### Verification Commands

```bash
# Full verification suite
npm run type-check && npm run lint && npm run build

# Component file check
ls -la src/components/LiquidGlass/LiquidSelect/
# Expected: LiquidSelect.vue, index.ts

# SCSS file check
ls src/components/LiquidGlass/styles/_liquid-select-menu.scss
# Expected: File exists

# Export verification
grep -c "LiquidSelect" src/components/LiquidGlass/index.ts src/components/LiquidGlass/plugin.ts
# Expected: index.ts:1, plugin.ts:2 (import + register)
```

### Final Checklist

- [x] All 6 tasks completed
- [x] Component renders with glass styling
- [x] Dropdown has glass effect
- [x] Single selection works
- [x] Multiple selection with chips works
- [x] Searchable filter works
- [x] Clearable button works
- [x] Loading state displays spinner
- [x] No TypeScript errors
- [x] No ESLint errors
- [x] Build succeeds
- [x] Component registered in plugin
- [x] Component exported from index
