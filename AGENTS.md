<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Architecture decisions
- No Supabase, Lovable Cloud or Lovable AI services: the app self-hosts on Netlify with Neon Postgres, Better Auth and OpenRouter. Why: owner requirement and deployment target.
- Feature folders `src/features/<name>/` with repository (userId-scoped DB), service (pure, tested) and functions (zod + requireUser server fns); see ARCHITECTURE.md. Why: easy for a human to extend.
- Money is stored as integer minor units plus currency code; reports convert to the user's base currency. Why: no float errors, multi-currency.
- Dev without DATABASE_URL uses in-memory PGlite migrated from ./drizzle. Why: zero-setup preview.
- Outside services live behind adapters in src/core/integrations. Why: swap providers without touching features.
- Conflict guidance uses an authenticated, consent-validated OpenRouter adapter and structured advice only; it never writes records or acknowledges syncs. Why: model suggestions must not silently resolve financial conflicts.
- Keep appearance in a shared ThemeProvider with browser-local preference and CSS semantic tokens; do not store it in financial settings. Why: it is device-specific and needs no server dependency.
- Use shared DeleteAction confirmation for financial record removal. Why: prevent accidental destructive actions with accessible dialog focus handling.
- Keep chart data alternatives adjacent to charts and use labelled states rather than colour alone. Why: visual reports must remain usable without sight or colour perception.
- Let Better Auth own salted password hashing, single-use recovery tokens, and session revocation; send recovery messages through a server-only email adapter. Why: passwords must not be reversibly encrypted or exposed to clients.
- Encrypt user-scoped financial snapshots and sync journals with AES-GCM using a PBKDF2-derived non-exportable device-passphrase key held only in tab memory; migrate plaintext before deleting it, and serialize encrypted writes with Web Locks. Why: locked browser storage must not expose finances or lose interrupted work.
- Require a device-vault unlock before financial loaders; disable financial SSR and HTML navigation caching, mark authenticated RPCs no-store, and broadcast key removal/cache clearing across tabs on lock or sign-out. Why: alternate caches and stale tabs must not bypass local protection.
- Secure sign-out revokes the server session online, deletes snapshots, and retains only encrypted journal work; local-only lock explicitly leaves the online session active. Why: protecting a shared device must not silently discard unsynced money or falsely claim session revocation.
- Keep sync outcomes in a user-scoped device journal; advance last-synced time only after a server acknowledgement, and preserve completed history separately from the active outbox. Why: connection status must never imply that a local save has reached the server.
- Register the generated Workbox app worker only through the preview-safe wrapper; never cache auth RPCs, reset pages, or server functions, and clear app caches at sign-out. Why: offline use must not compromise authentication or previews.
- Import the Netlify adapter only during builds; Vite owns local SSR and assets, including behind Netlify Dev. Why: duplicate emulators break local styling and configuration loading.
- Precache only a revisioned, data-free TanStack shell for offline navigation, regenerate Workbox after prerender, and never cache live navigation HTML. Why: cold starts and upgrades must preserve device-vault privacy.
- Treat public session lookup failures as signed-out only on the landing page; private guards still fail closed. Why: service outages must not prevent public startup or bypass account isolation.
- Capture browser installation events in one shared client-mounted control, with manual guidance when unavailable. Why: browser prompts are single-use and platform-dependent.
- Persist planning entities as schema-validated, versioned payloads in user-owned finance records; keep expense/account ledgers separate and validate linked ownership. Why: extensible planning must not silently alter balances or bypass account isolation.
- Parse statements and receipts on-device, keep raw documents transient, and save reviewed rows via stable encrypted outbox identifiers. Why: private documents and interrupted imports must not cause silent or duplicate financial writes.
- Store timestamped FX snapshots in Postgres and fail visibly when conversion is impossible; scheduled refresh and reminders use a secret-authenticated TanStack endpoint. Why: service outages must not turn foreign-currency money into zero or expose a public job.
- Restrict assistant tool output to validated internal destinations and explicit proposals; financial writes reuse the normal encrypted outbox after confirmation. Why: model output is untrusted and cannot authorize money changes.
- Keep export encryption separate from device keys and restore append-only with user/backup-scoped stable IDs; secondary PIN never substitutes for the vault passphrase. Why: backups and convenience controls must not undermine existing financial protection.
- Execute multi-record writes through transactional Neon HTTP batches, with PGlite transactions in preview. Why: Neon HTTP does not implement interactive transactions, and interrupted restores must not partially apply.
- Shared ledgers require owner-approved membership, hashed expiring invite codes and separate entries; naming a person grants no access. Why: collaboration must never expose personal account ledgers.
- Reconstruct dated net worth from account opening dates, acknowledged entries and carried-forward manual valuations; omit explicitly linked duplicate assets. Why: history must not fabricate prior balances or count wealth twice.
- Resolve auth cookies per allowlisted request origin; partition HTTPS preview cookies. Why: embedded sign-in must persist securely.
- Run journaled migrations only via the atomic CLI, validating legacy baselines first. Why: upgrades must preserve existing entries.
