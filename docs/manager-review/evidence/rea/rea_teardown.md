# Passive teardown of public HR-suite sites (2026-10-17)
Method: headless Chrome (temp profile, port 9333, no login/interaction) loaded 5 public homepages; REA inspect_web_page / analyze_web_bundle / discover_webmcp_tools run on them; plain `curl -I` (normal visitor HEAD) for headers and docs-URL status. REA tool surface worked fully. Chrome was killed afterwards.

REA limits seen: a CDP browser must be supplied (REA cannot open URLs itself; I launched one). Third-party origins (analytics, chat, auth vendors) are policy-filtered (`disallowed_origin`), so vendor identification relies on headers/CSP/target list, not REA bundles. Accessibility text, storage keys, console text = `not_approved` by default (not requested) -> a11y/i18n NOT assessed via REA. No screenshots taken; UX/pricing structure NOT analysed (only HTTP status of pricing pages).

## Observations (Evidence IDs)
| Site | Evidence | Stack / perf observations |
|---|---|---|
| BambooHR | inspect ev_a64ee9919cce31b2...1973d; webmcp ev_3ed0dd28...0d47 | 133 first-party resources, 3.26 MB (47 JS 1.67 MB, 62 img 0.9 MB, 19 CSS 0.46 MB, 5 fonts). Block-based JS (`/blocks/*/*.js`, `/scripts/delayed.js`) = pattern of Adobe Edge Delivery/Helix (header `x-cache-tag: main--bamboohr-website--bamboohr`, CSP allows `*.hlx.page`). Cloudflare + Varnish/Fastly layers, `cf-cache-status: HIT`, `max-age=14400`. CSP (report-only) lists Marketo, Adobe DTM/Target, GTM/GA, Hotjar, Clarity, Crazy Egg, 6sense, ZoomInfo, Clearbit, Drift, Intercom, Zendesk, Qualified, Salesforce webchat, Convert, Wistia, Cloudinary, readme.io. WebMCP tools: 0. |
| Rippling | ev_3cc1a9d3...ecd1 (inspect), ev_689d8330...099a (bundle) | Next.js (pages router, webpack, React) high confidence. 51 first-party resources, 4.7 MB (JS 3.09 MB over 38; one 1.33 MB CSS; 10 fonts). Largest chunks 677 KB, 440 KB, 306 KB, 270 KB. Vercel (`server: Vercel`, `x-vercel-cache: HIT`), `cache-control: public, max-age=0, must-revalidate`. Internal routes in bundle: `/api/www-vercel-revalidate`, `-algolia-reindex`, `-openprise`, `-add-to-zapier`, `-get-build-id`; cookies for UTM/gclid/fbclid; Optimizely, Algolia, Clearbit referenced in code; Qualified bot cookie ids. |
| Keka | ev_49a94ff7...b17d | WordPress (wp-content/themes/understrap, plugins) + jQuery. 147 resources, 2.2 MB, only 8 JS (247 KB) but 134 images 1.9 MB. Region paths `/us /ae /bh /kw` in header links (multi-region marketing). Cloudflare. Target list showed HubSpot conversations widget (chat) and Optimizely storage frame. Bare curl HEAD/pricing gets 403 (bot protection) while a real browser loads. |
| Darwinbox | ev_fcec3e90...5a9 (inspect), ev_0db495f4...2ecc (bundle) | Next.js (pages router, React). 66 resources, 6.58 MB, dominated by 17 CSS = 5.8 MB; 48 JS 0.75 MB. Storyblok headless CMS (`cdn/stories/layout/footer`, `/api/storyblok-fallback-img`). `x-nextjs-cache: HIT`, `s-maxage=3600, stale-while-revalidate`. No CDN vendor header visible. |
| Zoho People | ev_f654cc9c...e696 | Static first-party page: 21 resources, 0.5 MB (20 images, 1 JS). Cloudflare, `x-served-by: IN-DC`, strict HSTS preload. CSP names Zoho PageSense (A/B), Zoho SalesIQ (chat), ElevenLabs (voice/AI connect-src), Zapier, Wistia, Vimeo, Catalyst serverless, Zoho Bookings. Page auto-spawned geo-redirect tabs to zoho.{in,eu,uk,jp,sa,ae,sg,ca,com.au} (data-center routing, `mar-com.html`). |

## Public developer-doc surface (HTTP status only, curl)
- BambooHR: documentation.bamboohr.com -> 200 (redirects to /docs/getting-started; readme.io-style, readme.io in CSP).
- Rippling: developer.rippling.com 200 (2 KB, likely JS shell).
- Keka: apidocs.keka.com 200, developers.keka.com 200 (257 KB).
- Zoho People: /people/api/overview.html 200 (/people/api/ 403).
- Darwinbox: /api 404; no public API docs found at tried URL.
- Pricing pages: bamboohr 200 (46 KB), rippling 200 (1 MB), keka 403, zoho /people/pricing.html 404, darwinbox not checked. Content not read.

## Inferences (not directly observed)
- Rippling and Darwinbox: marketing-site Next.js; app (post-login) stack unknown. Do not infer product-app stack from marketing sites.
- BambooHR likely Edge Delivery/Helix-style static pages (inference from block layout + cache tag + CSP).
- Keka's chat = HubSpot (target URL), analytics beyond Optimizely not confirmed.
- Auth providers: none observed on public pages.
- Claimed integrations: not collected (marketing-page content not read).

## Takeaways for EMS (inference)
- Publish a public API reference (BambooHR/Keka do; Darwinbox does not visibly). EMS has Swagger at /docs and docs/API_MAPPING.md; a public readme-style doc site is a differentiator.
- Keep marketing payload lean: Keka ships 8 JS files; Rippling 3 MB JS and Darwinbox 5.8 MB CSS are cautionary.
- Region/data-center routing (Zoho, Keka) matches EMS's multi-country tenant direction.

## REA for the user's own repos
REA skill says skip it for ordinary source repos; use graphify (already configured) for code. REA is useful for EMS only on shipped artifacts: analyze_web_bundle/compare_application_versions on the built frontend (UI team) to compare releases, or inspect_web_page on a staging URL for payload/CSP checks. For the Fastify backend it cannot help (server code is not shipped); source-level audit is better.

## Not done / gaps
No screenshots, a11y/i18n, pricing-page structure, onboarding flows, or integration lists were examined. Analytics/auth vendors only via CSP/headers, not bundles.
