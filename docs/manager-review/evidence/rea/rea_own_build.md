# REA: ems-frontend .next (Next 16.2.6, Turbopack), BuildID Tpc6WjMLW-1jAlIFH5D3D
Evidence: REA analyze_javascript_application(.next/static, summary) = ev_2c6ec622...047bcc (child view ev_8490742a...d43b); trace IEXPR = ev_3e3ee6d8...a8aa8a (no-match, graph partial: 0 modules recovered for Turbopack format). All other facts = shell greps (observed, not REA).
Note: REA coverage "partial", 105 JS parsed, 0 parse failures. REA's module graph is empty for Turbopack output, so package attribution is by byte-pattern greps.

## 1 Composition
- .next 2.1G (2.0G = dev/ cache, irrelevant). Prod: static 6.2M (104 chunks, 105 JS incl. css), server 64M. No static .map, no sourceMappingURL in client (observed).
- Per-route uncompressed JS (manifest entry chunks): login/auth 1.52MB; typical dashboard page 1.5-1.8MB; /analytics 2.46MB; /dashboard 2.40MB; /_not-found 1.48MB; root shared (rootMainFiles) 457KB. Shared 1.48MB floor is loaded even by /login.
- Largest chunks: 0tmb 468KB (MSW + mock handlers, see 2), 3x 361KB, 326KB, 284KB (expr-eval), 228KB, 5x 144KB identical-size, 2x 124KB.
- The 3 x 361,400B chunks: NOT byte-identical (sha differ; 81k/131k bytes differ) but same 62 module IDs (observed). Contain recharts (68 refs). Referenced by /dashboard (0motfjgfa), /analytics (16ap2kzxsap33), 3rd by another route. Inferred: Turbopack emits a separate recharts chunk-group copy per route entry (same module set, differing order/ids) => recharts duplicated, about 1MB for 3 routes. 5x144KB, 2x124KB same pattern (inferred).
- Dead/heavy: expr-eval (284KB chunk 0s4byzdvnguw8, also module `IEXPR/TEOF` markers) is in the shared layout of ~60 routes incl. login/forgot-password, though only payroll formula code uses it (src/modules/payroll/utils/formula.utils.ts, pulled via payroll/index.ts barrel). Should be dynamic import or server-side. exceljs/pdf libs: not present in package.json or bundle (observed). recharts: lazy-load on /dashboard,/analytics (chart-only). zod 4, axios, date-fns-tz all in shared.

## 2 Security posture
- No secrets: no AKIA/sk_live/JWT literals (only placeholder AKIAIOSFODNN7EXAMPLE in a form), no onrender/hostinger/vercel/saqibsaeed hosts; API_BASE_URL absent from client chunks (server-only, observed). Only NEXT_PUBLIC_*: USE_MOCKS="false", APP_URL="http://localhost:3918" baked (observed, 1 chunk). localhost:3918 also appears as a webhook-URL placeholder string.
- Mock layer shipped: 0tmb.1stiq0p3.js (468KB, MSW 2.14.6 + handlers incl. seed emails hr@acme.test, superadmin@acme.test) and public/mockServiceWorker.js are in prod. Loader gate `NEXT_PUBLIC_USE_MOCKS` is constant-folded to the zod-parsed literal "false" inlined at build => cannot be enabled at runtime via env/query (observed gate; inferred non-flippable without code change). The chunk + SW are still publicly fetchable. Fix: tree-shake behind process.env condition / exclude public/mockServiceWorker.js in prod.
- Sinks: no eval/new Function; dangerouslySetInnerHTML only inside recharts internals; innerHTML refs are React/Next internals. localStorage used for UI prefs (column/filters), no token keys observed.
- Server: .next/server/**/*.map exist (server-only, not served). middleware-manifest empty: no middleware/proxy; no server actions; no next/image or next/og in src; /_next/image endpoint still active (images-manifest, domains []).
- BFF proxy (route.ts): compiled route (0213_next_dist_esm_build_templates_app-route_13yqqat.js) builds `${base}/${path.join("/")}${search}` with NO `..`/%2e%2e sanitisation (observed). Node `new URL` check: `base/api/v1/` + `%2e%2e/health` => `/api/health` (observed, normalisation escapes the /api/v1 prefix). Host cannot change (inferred), so it is path-escape on the same backend host (reach /health,/docs,/ops, any non-/api/v1 route), not full SSRF. Whether Next passes `..`/%2e%2e into params un-normalised: UNKNOWN (not run). Proxy is also unauthenticated passthrough; backend authz is the only gate. Fix: reject segments equal to `.`/`..`/containing `%`/`/`, allowlist prefix, and assert resolved URL startsWith base.
- expr-eval trace: REA trace_application_feature IEXPR = no-match (graph partial, 0 modules). Grep shows parser in client chunk 0s4byzdvnguw8; formula.utils.ts calls parser.parse(formula).evaluate(vars) (lines 271-313) with formulas from tenant-authored payroll components (backend data). Custom funcs SLAB/CLAMP only. Reachable if a tenant admin/compromised backend supplies a malicious formula: expr-eval<=2.0.2 CVEs (critical code exec / proto pollution / unrestricted functions) execute in the viewer's browser (stored XSS-equivalent across HR users). Inferred, not demonstrated.

## 3 Features / API diff
- Routes: 62 page.js, 58 prerendered HTML + 1 API catch-all `/api/[...path]` (GET/POST/PATCH/PUT/DELETE). Areas: auth(6), dashboard, employees(new/[id]/edit), departments, attendance, leave, timesheets, holidays, payroll(+[runId], my-payslips, migration, global), payout-methods(+approvals), settings (about 30 subpages incl pay/*), recruitment, performance, assets, announcements, reports, analytics, permissions.
- Permission keys in bundle (~60): analytics:read/team-read, employees:read/read-any/write/delete/export, leave:request/approve/team-read/manage-types/policy-manage/export, attendance:read/team-read/write/approve/export, payroll:admin/approve/export/self-read/super, payout:manage/self, timesheets:admin/approve/read/write, settings:manage/tenant-write/security/integrations, permissions:manage, billing:read/export, audit:read/export, reports:read/schedule, assets/recruitment/performance/announcements:*. can() trusts /auth/me permissions[]; SUPER_ADMIN bypass client-side (UI only).
- FE endpoints extracted from non-mock chunks: 356 call sites; 350 match backend (421 routes parsed from src/modules/**/*routes.js, verb+path with params wildcarded). Mismatches (observed):
  1. GET /leave/requests/preview: backend is POST /leave/requests/preview (wrong verb, will 404/405).
  2. GET /payroll/runs/:id/bank-file/preview: no backend route (only GET /bank-file).
  3. GET /settings/webhooks/:id/deliveries: missing (backend has webhooks CRUD + /test only).
  4. POST /timesheets/approvals/bulk-approve and bulk-reject: missing (backend has GET /timesheets/approvals; bulk exists only for /leave/requests).
  (/timesheets/projects${qs} flagged by parser = false positive.) Caveat: regex catches literal-string calls only; dynamically built URLs and PUT usage (backend has no PUT routes) not fully covered. Lists: scratchpad/fe_calls.txt, be_routes.txt.

## 4 CVE reachability (pnpm audit --prod: 108 vulns, 5 critical; npm registry only)
- next 16.2.6 (<16.2.11 / <16.3.3 / <16.3.8): reachable surface in this app = App Router + route handler + /_next/image (default on). Not reachable (observed absent): middleware/proxy bypass, Server Actions DoS/SSRF, rewrites SSRF, next/og RCE. Image-optimisation RCE/SSRF criticals: endpoint present, exploitability UNKNOWN (remotePatterns empty). Cache-poisoning/SSG advisories: pages prerendered, applies only if self-hosted behind cache. Upgrade to >=16.3.8 clears all.
- expr-eval 2.0.2 (critical): code IS in shipped client bundle (see 2). Fix: replace with expr-eval-fork or a restricted evaluator, move off the client.
- axios 1.16.1 (<1.20.0, several high): Node-adapter/HTTP2/proxy items n/a in browser; client bundle includes xhr/fetch adapter, prototype-pollution gadget items possibly relevant (unknown). Upgrade to >=1.20.
- hono/@modelcontextprotocol/sdk/postcss-selector-parser come via shadcn CLI (dependency in `dependencies`, should be devDependency; not in bundle).

## 5 Version comparison
None: single BuildID, no prior .next/ ; git stash@{0} is source (payout-pull preservation), not a build. compare_application_versions not run.
REA sessions: none opened (JS analysis only; retained evidence in ledger, nothing to close).

## CI release gate (concrete)
1. Build prod with NEXT_PUBLIC_USE_MOCKS=false; run analyze_javascript_application on .next/static; fail on: any .map in static, `sourceMappingURL`, regex secrets (AKIA, sk_, eyJ, re_), hosts not in allowlist, localhost URLs, strings `setupWorker|mockServiceWorker|@acme.test` (mock chunk present), public/mockServiceWorker.js present.
2. Budget: per-route uncompressed JS and shared floor (fail >5% growth vs baseline); fail if shared chunks contain expr-eval (`IEXPR`) or recharts duplicates (same module-set hash in >1 chunk).
3. compare_application_versions vs previous release build: report added/removed chunks, new endpoints/strings; require review for new fetch hosts or eval-like sinks.
4. Endpoint contract gate: extract FE URL+verb from bundle, diff against backend route list (as done here); fail on missing/verb mismatch.
5. pnpm audit --prod with allowlist; fail on critical in packages present in bundle.
6. Test BFF with `%2e%2e` against a local echo upstream.
