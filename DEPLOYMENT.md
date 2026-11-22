# Artha on Netlify

## Required setup

Use Node **22.12 or newer** (Netlify uses Node 22 from `netlify.toml`). Install dependencies with `bun install` or `npm install`. Keep secrets out of Git and never prefix them with `VITE_`.

Configure these variables on Netlify with **Builds and Functions** scope:

| Variable | Required value |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string with TLS (`sslmode=require`) |
| `BETTER_AUTH_SECRET` | A random secret of at least 32 characters; keep it stable across redeploys |
| `BETTER_AUTH_URL` | Your canonical HTTPS origin, e.g. `https://your-site.netlify.app` (no path) |

Generate a secret locally using `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`. Paste it into the hosting settings, not source code. Rotating it can invalidate existing sessions.

Optional: `RESEND_API_KEY` + `PASSWORD_RESET_FROM` (verified sender) for recovery emails; `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` for consented chat/conflict advice. The rest of the app does not require these providers. A present key is not a successful provider check; the currently checked OpenRouter key returned 401.

Apply the checked-in Drizzle migrations to Neon **before first use**, using `bun run db:migrate` with `DATABASE_URL` in your local environment. This is a database change: review migrations/backups before running against real money data. In-memory preview data is not transferred to Neon.
Apply all migrations in order, including `0001_safe_molly_hayes.sql` (planning, FX and push) and `0002_medical_sphinx.sql` (shared groups, membership, invitations and entries). Never apply only the initial migration on an expanded installation.
The migration command also supports an existing original installation whose tables were created without a migration journal: it first checks the core columns, constraints and indexes, records the initial baseline, then applies the pending migrations in one transaction without deleting entries. Partial or incompatible original schemas stop for review. Run the command once against each target database before redeploying; builds and page visits do not change the database schema automatically.

## Evening reminders and daily exchange rates
Configure `JOB_SECRET` (at least 32 random characters), `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and `VAPID_SUBJECT` (a valid contact `mailto:` or HTTPS address). Generate Web Push keys locally with `npx web-push generate-vapid-keys`; keep the private key out of browser code and Git. Netlify needs these in Functions scope.

The checked-in `netlify/functions/daily.ts` is a scheduled function at `30 14 * * *` UTC (8 PM Asia/Kolkata). It invokes the secret-checked `/api/public/scheduled` endpoint. Confirm the scheduled function appears and is enabled after deployment; a local preview does not prove scheduled delivery. It refreshes INR plus cached base-currency FX snapshots and sends generic reminders without financial amounts. Subscriptions to arbitrary/private endpoints are rejected; expired subscriptions are removed. Users still must enable browser notification permission in Settings and send a test. iOS Web Push requires an installed supported home-screen app. Hosting/provider limits can affect delivery.

The ordinary finance app works without these keys; the reminder switch stays unavailable until configured. Password-reset delivery additionally needs a verified `PASSWORD_RESET_FROM`; no sender is currently configured. Investment suggestions remain disconnected until the owner supplies a working API contract; the provided ABC.com link was a 404.

## Deploy

1. Connect the repository to Netlify.
2. Build command: `npm run build`. Publish directory: `dist/client`. Both are in `netlify.toml`.
3. Add the variables above and deploy. Redeploy after changing production variables.
4. The adapter generates `.netlify/v1/functions/server.mjs`. Do **not** set `dist/server` as the publish directory, drag-and-drop only `dist/client`, add a `/* /index.html 200` redirect, or run a second SSR adapter.
5. Open `/auth`, create/sign into an account, unlock local protection, add an expense, reload and confirm it reads back. Check Netlify **function logs** for any server error; browser `content.js` video-listener messages are normally from an extension and do not diagnose an Artha 500.

Public startup tolerates a session-service outage; sign-in and private data still require correctly configured credentials and migrated Neon tables. A styled public page is not proof the database works.

Checked 21 November 2026: `https://artha98.netlify.app/` and its exact linked CSS/JS assets returned 200 with correct content types. Its manifest, service worker, 192/512 icons and offline shell also returned 200. This verifies public asset serving, not authenticated production finance flows or native installation/offline restart. Redeploy this expansion after applying all migrations; the live site is not automatically updated by saving this code.

## Local development, including Windows

Copy `.env.example` to `.env` (ignored by Git), then set local `BETTER_AUTH_URL=http://localhost:8888` for Netlify Dev, or `http://localhost:5173` for direct Vite. Keep your production HTTPS value only in Netlify. Start one of:

```sh
npm run dev
# Open http://localhost:5173

npx netlify dev
# Open http://localhost:8888; it proxies Vite on port 5173
```

The Netlify adapter is loaded **only for builds**, not local development. This prevents duplicate SSR emulation and Deno startup during Vite dev. Static assets come from `public`; styles, scripts and SSR come from Vite. No manual `/src/*` or `/@vite/*` production redirects are needed.

If a previous Netlify Dev run generated a stale server function, stop both local processes, delete the **generated** `.netlify/functions-serve` and `.netlify/v1` folders (not the whole `.netlify` folder, which may store your site link), then run Netlify Dev again. Do not run a build immediately before Netlify Dev; it can discover the build's generated function instead of proxying Vite. Update the Netlify CLI if it still discovers an old function. Use direct Vite to isolate proxy problems.

Verify `/manifest.webmanifest` returns JSON, `/src/styles.css` returns CSS, and `/@vite/client` returns JavaScript on port 8888. An HTML response for one of those means an old function or redirect is intercepting assets. For a 500 on sign-in, check terminal/function logs for missing variables, database connectivity, or missing tables; never share connection strings or cookies in logs.

## Install and offline checks

Run `npm test` before deploying. The suite includes real Workbox generation against temporary fixtures, checking that the startup shell is revisioned and financial HTML/JSON are excluded. This does not replace a production Netlify build or an actual offline cold-start test on your deployed address.

The manifest preserves `/dashboard` as the installed start URL and supplies 192px/512px icons. The **Install Artha** button opens Chrome/Edge's native prompt when the browser offers it, otherwise shows manual instructions. Safari on iPhone uses Share → Add to Home Screen. Browsers decide eligibility and timing: an automatic prompt is not guaranteed.

Offline support runs **only on the deployed HTTPS app**, never inside the editor or Vite dev. The generated Workbox worker precaches assets and a revisioned, data-free startup shell; no live financial HTML, authentication responses, reset pages or financial RPC responses are cached.

After deployment:
1. Visit online, sign in, unlock the device vault, and visit the pages/filters you need offline.
2. Wait for `/sw.js` to activate, install if desired, then close and reopen the app without internet.
3. Confirm the vault requires its passphrase and saved pages load; new filters with no snapshot may be unavailable.
4. Add an expense offline. Confirm the banner says it is saved locally, not online.
5. Reconnect with the app open and unlocked. Confirm the sync history completes and the expense appears once after reloading.
6. Sign out online; confirm other tabs lock and no financial text is visible. Encrypted pending work stays on the device until the same account unlocks it.

Installation does not provide a separate backup. Never clear browser storage to fix an icon or update issue while unsynced entries remain. For a stuck worker, use `?sw=off` online to unregister the app worker without deleting the encrypted journal, then reopen the normal URL. The changed theme/icon metadata may require reinstalling an existing home-screen app; do not change its start URL to repair updates.

## Held integrations and optional packaging
- **OpenRouter:** replace the rejected key in your hosting secret settings, then redeploy. The existing key returned HTTP 401; neither AI chat nor live proposal confirmation is considered verified. Never paste private keys into chat or source.
- **Investment suggestions:** provide a real HTTPS endpoint and request/response/authentication documentation. `abc.com/get/suggestion` is ABC Entertainment's 404 page. Manual portfolio and SIP planning work independently; no trades or invented recommendations are generated.
- **Account Aggregator:** choose/onboard a licensed provider with an approved consent flow before adding its server adapter. There is no browser API for directly reading GPay records.
- **Android:** the PWA is the current mobile delivery. A signed Android wrapper with direct SMS access is optional separate packaging; it needs signing, Android permissions/store policy and privacy review. Browser receipt camera and pasted SMS text work without those permissions. Do not request READ_SMS in a web manifest or claim native packaging is delivered.
- **Tax:** only the explicitly verified historical year/cases are calculated. Future-year verification and professional review of unsupported special cases are required before widening that scope.

The OCR worker, PDF worker modules/WASM and English reading data are included in offline precache. Offline parsing still requires a successfully activated worker and previously visited financial pages; validate this after deploying the latest revision.