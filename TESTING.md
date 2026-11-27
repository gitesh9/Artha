# Testing Artha

| Layer | Where | Command |
|---|---|---|
| Rules & calculations (unit) | `src/test/unit/*.test.ts` | `bun run test:unit` |
| Everything in Vitest (unit, component, security, migrations) | `src/test/**` | `bun run test` |
| Speed budgets for calculations | `src/test/unit/performance.test.ts` | included above |
| Browser end-to-end on 7 devices (UI, flows, accessibility, overflow, load speed) | `e2e/run_e2e.py` | `bun run e2e` then `bun run e2e:cleanup` |

Not covered by design: live OpenRouter calls, investment API, Google sign-in.

## Devices in the browser suite
Desktop Chrome 1440px, desktop Firefox 1280px, Safari/WebKit laptop 1024px, iPad, iPhone 13, Pixel 7, Galaxy S9+ (320px).
Run a subset: `python3 e2e/run_e2e.py iphone-13 pixel-7`. Results: `/tmp/artha-e2e/report.json` plus screenshots.
Set `BASE_URL` to test another server, e.g. `BASE_URL=https://your-site.netlify.app bun run e2e`.

## What every private page is checked for
Renders without the "page is unavailable" error, returns to the requested page after unlocking, loads within budget,
no sideways scrolling, WCAG A/AA axe scan (desktop Chrome + Pixel 7), no uncaught errors, theme toggle works.
Flows: create account → add tagged expense → see it in history, tag filter and Overview; signed-out redirect; wrong password error.

## Adding a test
1. **A money rule or calculation** (pure function in `src/features/<name>/service.ts`): add an `it(...)` inside the matching
   `describe` in `src/test/unit/core-rules.test.ts` (or a new `src/test/unit/<feature>.test.ts`). Use concrete values in paise:
   `expect(budgetStatus(80, 100)).toBe("warning")`. One rule per test.
2. **A component**: create `src/test/<feature>.test.tsx`, render with `@testing-library/react`, query by role/label, never by CSS.
3. **A new page**: add its path to `PAGES` in `e2e/run_e2e.py`; it automatically gets render, overflow, speed and axe checks.
4. **A new user flow**: add steps to `flows()` in `e2e/run_e2e.py` using `open_private(page, url, passphrase)` (a full reload
   locks the device vault by design), labels (`page.get_by_label`) and roles, then `check(name, "what should be true", condition)`.
5. **A new device**: add an entry to `DEVICES` using any Playwright device name.
6. **A speed budget**: add a case to `performance.test.ts` or tune `PERF_BUDGET_MS` (dev-mode numbers include vault unlock).

Run `bun run test` before committing; run `bun run e2e` before deploying.

## Production vs preview
Run the same suite on the live site: `BASE_URL=https://artha98.netlify.app python3 e2e/run_e2e.py`. Budgets are stricter in production
(TTFB 1.5s, FCP 3s, private page incl. unlock 8s, menu switch 2s, tap feedback 500ms). The report prints p50/p95 per metric;
failures are real — do not raise a budget to make a run pass. Production tests the deployed build, so redeploy first.
Edge cases (`edge_cases`): 404 page, short password/bad email, duplicate sign-up, wrong vault passphrase, zero/negative/empty/3-decimal
amounts, ₹9.99 crore amount, HTML injection in notes, transfer to same account, offline banner on/off.
