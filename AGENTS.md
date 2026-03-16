# Agent Rules (personal-site-tanstack)

## Tests Are Required For Feature Work

When adding or changing user-facing behavior, always add tests in the same PR:

- Unit/integration tests where the logic lives (pure functions, server utilities, etc.)
- E2E tests for the user workflow when it’s visible in the UI

If a change is not realistically testable, document why in the PR description and add the closest feasible automated coverage.

## E2E Selectors Must Use `data-testid`

All Playwright e2e selectors must use `data-testid` (via `page.getByTestId(...)`):

- Do not select by visible text (`getByText`, role name, etc.)
- Do not select by placeholder/label as the primary selector

When implementing new UI that needs e2e coverage, add stable `data-testid` attributes to the relevant elements.

