# Agent Rules (personal-site-tanstack)

## Tests Are Required For Feature Work

When adding or changing user-facing behavior, always add tests in the same PR:

- Unit/integration tests where the logic lives (pure functions, server utilities, etc.)
- E2E tests for the user workflow when it’s visible in the UI

If a change is not realistically testable, document why in the PR description and add the closest feasible automated coverage.

## E2E Selectors Must Use `data-testid`

All Playwright e2e selectors must use `data-testid` (prefer `page.getByTestId(...)`):

- Do not select elements by visible text (`getByText`), labels/placeholders, role name text, or CSS structure.
- If a stable `data-testid` does not exist, add one in the UI/component instead of using a text-based selector.
