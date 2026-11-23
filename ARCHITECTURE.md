# Artha — Architecture Guide

A personal money manager. Stack: TanStack Start (React 19, SSR, server functions), Drizzle ORM + Postgres (Neon), Better Auth, Tailwind v4. Deployment targets Netlify Functions using the official TanStack adapter. No vendor lock-in: every external service sits behind a small adapter.

## Folder map
```text
src/
  core/                    Infrastructure shared by all features
    db/schema.ts           ALL tables (Drizzle). Single source of truth.
    db/client.ts           getDb(): Neon in prod, in-memory PGlite in local dev without DATABASE_URL
    auth/auth.ts           Better Auth config (add Google login etc. here)
    auth/middleware.ts     requireUser — put on EVERY private server function
    auth/session.functions.ts  getCurrentUser() for route guards
    auth/client.ts         Browser auth client (signIn/signUp/signOut)
    integrations/          Adapters to outside services (currency rates today; AI, investment API, push next)
  features/<name>/         One folder per feature
    repository.ts          DB queries only, always filtered by userId
    service.ts             Pure business rules (no I/O) -> unit tested
    functions.ts           createServerFn endpoints: validate (zod) -> auth -> repo/service
    components/            Feature UI
  shared/                  Cross-feature utils: money, dates, categories, query keys, layout components
  routes/                  Thin page files (file-based routing)
    _authenticated/        Everything here requires login (guard in route.tsx)
    api/auth/$.ts          Better Auth HTTP endpoints
  test/                    Vitest tests
drizzle/                   Generated SQL migrations
```

## Core rules
1. **Money is integer minor units** (paise/cents) + currency code. Use `toMinor` / `formatMoney` from `shared/money.ts`. Never store floats.
2. **Every query is scoped by userId** in the repository. Never trust an id from the client without the userId filter.
3. **Server functions**: `.middleware([requireUser]).inputValidator(zodSchema).handler(...)`. Import server-only modules (db, repos) with `await import()` inside the handler.
4. **Reports are converted to the user's base currency** via `features/analytics/convert.server.ts`.
5. **Pure logic lives in service.ts** and gets a test in `src/test/`.
6. **Styling uses design tokens** in `src/styles.css` (`bg-primary`, `text-income`, `text-expense`…). No raw colours in components.

## Patterns used
- Repository (data access), Service layer (pure rules), Adapter (external APIs behind interfaces, e.g. `RatesProvider`), Validation at the boundary (zod), Central query keys (`shared/queries.ts`) so one `invalidateMoney()` refreshes all money views.

## System and data flow
```text
TanStack page -> vault gate -> TanStack Query -> authenticated server function
                                  |                       |
                         encrypted device snapshot    user-scoped repository -> Neon
Expense confirmation -> encrypted sync journal -> acknowledged transaction -> refreshed report
Local PDF/CSV/XLSX/OCR -> reviewed rows -> same encrypted expense journal
Consented chat -> OpenRouter -> validated proposal -> explicit confirmation -> same journal
Owner-approved membership -> shared ledger (never personal account ledgers)
Netlify scheduled job -> secret-checked endpoint -> FX snapshots / generic Web Push
```

## How to add a feature
1. Define its money/ownership contract first. Use versioned `finance_record` payloads for planning entities; use separate relational tables where membership or ledger relationships need constraints. Add schema to `core/db/schema.ts`, generate and review a migration, and test upgrading an existing database.
2. Create a browser-safe Zod contract in `features/<name>/schema.ts` or `service.ts`. Keep amounts as integer minor units and dates validated. Never trust IDs, currencies, or AI suggestions without validation.
3. Implement `repository.ts` with `userId` on every personal read/write and explicit linked ownership. Shared groups additionally check approved membership; only their owner can approve access.
4. Implement pure `service.ts` calculations and concrete business-rule tests beside `src/test/`. Add a PGlite integration test for ownership and write replay. Use `core/db/atomic.server.ts` for multi-record mutations: Neon HTTP requires transactional batches, not interactive transactions.
5. Add a validated `requireUser` server function, dynamically importing server dependencies within its handler. Return plain data; preserve no-store headers. Provider credentials belong only in the handler.
6. Add a unique leaf head and vault-gated route loader with `ensureQueryData`; use `useSuspenseQuery`, semantic tokens and accessible exact-value alternatives. Add the navigation entry only after the page exists.
7. Existing expense writes use encrypted journal UUIDs. Other offline mutations must remain disabled until their operation-specific replay/conflict behavior is tested. Verify saved readback, network failure, mobile and locking before documenting completion.

## Expanded finance modules
- `insights`: equal-length comparisons, custom/month pairs, independent budget pace, full daily grid, category and cumulative tables, saved comparisons.
- `imports`: PapaParse, read-excel-file, PDF.js and Tesseract execute on-device. Local OCR engine/language assets are served/pre-cached by Artha. Files stay transient; saved review fields are encrypted. Format mapping is user-reviewed, not a promise of universal bank extraction.
- `planning`: versioned assets/liabilities, manual holdings/flows and XIRR, goals/contributions, income sources, splits, bills/finite EMI schedules and saved forecasts. Ledgers are separate: planning records never silently update account balances.
- `groups`: private shared ledgers with SHA-256-hashed 7-day invite codes, pending membership requests and owner approval. Shared records only include group entries; no personal transactions are exposed. Removed members lose server access, but information previously viewed cannot be remotely erased.
- `tax`: historical FY2025–26 resident-under-60 estimates, listed-equity cases, ordinary-income surcharge/marginal relief and sourced legal context. Unverified years and mixed capital-gains surcharge above ₹50 lakh remain explicitly unsupported. Advance-tax targets subtract user-entered expected TDS/TCS and use the general ₹10,000 threshold.
- `planning/wealth-service`: dated account-inclusive net worth and received income categories with range/custom-date reports; manual valuations carry forward and linked duplicate assets are excluded. Opening balances begin at account creation, not an invented historical date. Safe read limits fail visibly rather than returning partial totals.
- `assistant`: bounded, consented OpenRouter context; validated internal destinations, selected-period report access, expense proposals and user-supplied form assumptions. Provider output cannot authorize writes.
- `backup`: separate passphrase encryption, strict validated preview, append-only atomic restore and backup/user-scoped deterministic IDs. Missing budgets are restored, existing category limits/preferences are retained. Currency conversion must be available before any restore write. Shared ledgers and encrypted pending journals are not included in the financial export.
- `reminders`: opt-in generic Web Push at 8 PM India time plus daily timestamped FX refresh. Deployment keys/permission and the hosting schedule must all exist. This is not expense background sync.

## Verification scope
The cashflow expansion adds canonical hashtags in transaction notes (retained through encrypted imports/backups), paired `transfer_in`/`transfer_out` rows with a shared ID, confirm-only salary schedules and unpaid-first bill review. Transfers are atomic, removed as a pair and excluded from spending/earnings; FX transfers store actual sent/received amounts. A linked SIP confirmation atomically records its bank expense and holding buy flow with actual units; market valuations remain manual. Cash-reserve guidance converts all accounts to base currency, reserves scheduled obligations and a recorded-spending buffer, and suppresses actionable advice while local entries remain pending. Google OAuth is optional and keeps the existing device-vault gate.

Signed-in browser checks cover CSV/XLSX parsing, receipt photo OCR, scanned/text PDFs, confirmed expense sync/readback, dated net worth, holdings/valuation/XIRR, goals, splits, saved comparisons/forecasts/tax scenarios, encrypted export/restore and owner-approved shared entries read by a second account. Device-lock checks reject a wrong PIN and unlock only with passphrase plus correct PIN. Automated WCAG A/AA-tagged axe checks found no violations on twelve new pages in both themes; this is not certification or a substitute for manual screen-reader testing. Tests cover vault/PIN failure-closed behavior, atomic restores, account ownership, tax boundaries, reminder scheduling and FX snapshot failover. Live OpenRouter currently returns 401; notification/email delivery and the latest deployed authenticated offline restart need the external setup listed in DEPLOYMENT.md.

## How to add an external integration (AI, your investment API)
Create `core/integrations/<name>.ts` exporting an interface + one implementation that reads its key from `process.env` inside the function. Call it only from server functions.

## Commands
- `bun run dev` · `bun run test`
- `bun run db:generate` — create a migration after schema edits
- `bun run db:migrate` — apply migrations to DATABASE_URL (Neon)

## Deploying free
1. Create a Neon project, copy the connection string.
2. `DATABASE_URL=... bun run db:migrate`
3. Follow `DEPLOYMENT.md` for Netlify environment variables, build settings, migrations, local proxy troubleshooting, and PWA checks. The adapter generates the SSR function; `dist/client` contains only public assets.

See `roadmap.md` for what's next.

## Password security and recovery
Better Auth stores email as the account identifier and passwords as salted **scrypt hashes**, never plaintext or reversible encryption. Neon provides encryption at rest; use TLS connection strings. Recovery uses Better Auth's single-use, one-hour tokens, and revokes database sessions after a reset. Signed-in changes require the current password and revoke other sessions.

Set `RESEND_API_KEY` and `PASSWORD_RESET_FROM` (a verified Resend sender) on your hosting. No Lovable email/AI gateway is used. Set `BETTER_AUTH_URL` to your published HTTPS origin so reset links point to your app. Secrets stay outside source control. Reset delivery is disabled until both email settings exist. Publish after changing production secrets.

## Offline and failure recovery
`core/offline/storage.ts` owns encrypted IndexedDB snapshots and an account-scoped outbox. Cache snapshots contain financial data, not passwords, session cookies, or recovery tokens. A device-passphrase vault must be unlocked before financial loaders run. Online verification enables offline access for 24 hours; offline cached identity never authorizes a server write. Only previously visited pages/filters are available offline. Reports display last synced values; pending entries appear separately.

New income/expense entries are persisted encrypted before sending. Reconnection, an open-app 30-second retry, and manual Retry sync replay the queue after checking the current server user. Stable UUIDs + primary-key conflict handling + exact payload comparison prevent duplicate writes after a lost response. Only an acknowledged entry leaves the queue. Rejected/deleted-account entries remain visible and are not silently discarded. Account/budget edits, deletion, security changes and sign-in require internet. Secure sign-out locks every tab, clears Query and financial snapshot caches, and revokes the current online session; the encrypted sync journal remains, including pending entries. Password recovery also locks local access but preserves encrypted entries for the same user to sync after signing back in and unlocking.

`core/offline/register.ts` is the only registrar. `vite-plugin-pwa` generates `/sw.js`; dev, iframe and Lovable previews never register it. TanStack prerenders a data-free shell at `/offline.html`; a final build hook regenerates Workbox after prerender to revision the shell and assets. Navigation uses NetworkFirst with HTML caching disabled, falling back to that shell only on network failure. Hashed assets are precached. Old `artha-pages` plaintext document caches are deleted on initialization. Financial routes disable SSR so private values do not enter HTML documents, and session/financial RPCs are `Cache-Control: no-store`. Auth endpoints, server functions, OAuth and password reset pages are never runtime-cached. The shared InstallApp control captures browser install events after mounting, consumes single-use prompts, hides after installation, and offers Safari/browser-menu instructions when necessary. Offline reopening requires visiting the published app online first, entering the device passphrase, and a still-valid cached identity; closing the app pauses outbox sync until it is reopened. This is not unattended background sync. Cold-start offline behavior must be checked on the published app, not the dev preview.

Navigation shows immediate loading feedback, shared loading placeholders and retriable errors. Query reads retry once; non-idempotent writes are never blindly retried. Browser storage failures keep entry forms open instead of claiming a save. Service recovery is not database disaster recovery: configure Neon backups separately for your hosting plan.

## Sync visibility and device history
`core/offline/sync-service.ts` contains pure journal transitions. `storage.ts` stores a user-scoped encrypted `artha:offline:sync:v3:<userId>` IndexedDB journal containing pending, failed and completed entries, saved/attempted/completed timestamps, attempt counts, and the last confirmed write time. Legacy v1 outbox entries and v2 journals are migrated after unlock; old copies are removed only after encrypted saves succeed. Older completed writes have no fabricated history. Only `acknowledgeEntry` advances the last-synced timestamp. Server-session failures and individual expense failures retain the local copy; a failed entry does not block later entries in a batch.

`OfflineProvider` surrounds the entire unlocked signed-in shell and unmounts on lock. `SyncBanner` remains visible below the header on every financial page, separately labelling internet availability and unconfirmed local writes. `/sync-history` reads local context, not a network loader, and has URL-backed status filters and targeted/all-entry retry controls. History is device-local, includes income entries too, and remains encrypted at sign-out; it is not a cross-device audit log or a database backup. Failed attempts record their latest timestamp and cumulative count rather than a row for every network attempt. A successful retry preserves the original local-save timestamp and stable entry ID. The browser must keep the app open and unlocked for sync to run.

## Local encryption and device locking
`core/offline/vault.ts` derives a non-exportable AES-256-GCM key with Web Crypto PBKDF2-SHA-256 (600,000 iterations, random 16-byte salt). Each write gets a fresh 12-byte nonce; storage-key additional authenticated data binds ciphertext to its purpose and account. Only salts, an encrypted verification value, nonces, and ciphertext persist. Passphrases never leave the form/browser or go to a server; CryptoKeys stay in a module-local map for the current tab lifetime and are dropped on lock. Memory removal is logical, not a guarantee of immediate physical RAM zeroization. There is no escrow, recovery key, or passphrase reset; forgotten passphrases may lose unsynced work. Login-password recovery does not recover this vault.

`/local-vault` requires a real session online or a valid cached identity offline. `_authenticated` gates all financial loaders behind an unlocked vault. Browser reload/close loses keys; BFCache restoration also locks. `BroadcastChannel` and a storage-event signal (no identifying or secret payload) lock other open tabs, cancel financial queries and remove their visible financial UI. Signing in as any account also locks old tabs. Encrypted reads and writes check lock generations to avoid repopulating decrypted state after lock. Web Locks serialize read/decrypt/update/encrypt journal operations across tabs; an in-tab promise queue is the fallback, without cross-tab guarantees where Web Locks are unsupported.

Online sign-out immediately locks local data even when server revocation fails, deletes financial snapshots and offline identity, and retains the encrypted journal/configuration. The user sees a retry warning if the online session could not be revoked; local-only Lock explicitly leaves that session active and does not protect access to server data by someone misusing the still-authenticated browser. Clearing browser caches can fail, but remaining financial copies are still encrypted. Unlocking journal work after sign-out requires signing in to the same account and its device passphrase. General device/account metadata (user ID, name, email, expiry, storage key names) remains readable. Other account legacy plaintext is migrated only by that account on unlock, not silently deleted. Earlier backups, browser forensic traces, malicious extensions, injected same-origin scripts, active-session misuse, and an unlocked screen are outside this protection. Recommend separate OS/browser profiles, device encryption, and a screen lock. Offline identity expiration does not erase ciphertext.

## Conflict guidance
`features/sync-assistant` validates descriptions and explicit consent, then calls the server-only `core/integrations/openrouter.server.ts` adapter through a `requireUser` server function. The provider key is read only inside the handler. `/sync-history` lets the user describe both versions; Review versions copies a local entry into the first field, not to the provider. Only an explicit comparison sends the supplied text to OpenRouter and its model provider. Nothing else from the financial database or journal is sent. Responses are schema-validated, rendered as text and never applied. A 25-second timeout or provider failure retains form text and exposes a safe retry, with no cross-provider fallback. The assistant does not retrieve or verify the online counterpart and is not a resolution editor. Draft descriptions stay in React state only and are lost on navigation/reload; the sync journal is unaffected. Advice becomes hidden when its inputs change. Publish after changing production secrets and configure the same environment variables on self-hosted deployments.
