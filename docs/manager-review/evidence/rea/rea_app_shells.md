# Competitor public app-shell teardown (passive, anonymous, 2026-10-17)
Method: anonymous GET of login/home/status pages (curl, shells saved in scratchpad/deep/shells/), REA capture_browser_scenario (headless Chrome, load + 4s settle, no interaction). Raw REA evidence: ev_5d54e909 (Deel), ev_12625f53 (Rippling), ev_e5fb6ccf (Hibob), ev_f84c6b2c (Factorial), ev_1545d364 (Keka), ev_403c7893 (Darwinbox marketing). No .map files probed; no APK/IPA fetched. Tags: [O]=observed [I]=inferred [U]=unknown.

## Per vendor
Keka (app.keka.com/Account/Login) E-KEKA-1
- [O] Server-rendered ASP.NET Core MVC (antiforgery + TempData cookies, Identity.TwoFactorUserId cookie), jQuery + Bootstrap + intl-tel-input + jquery-validate; 6 scripts, 138KB gz, 44 requests total, zero 3rd-party origins except reCAPTCHA CSP; all assets on cdn.keka.com/login/v/2026 (versioned+SRI-style hash). No manifest, no workers.
- [O] Login has Google + Microsoft buttons, phone input; 2FA cookie name implies TOTP/OTP. [O] iOS app 15 languages, 4.91/68 ratings. Marketing site WordPress, 10 hreflang.
- [I] Post-login app is a separate SPA (unseen). Lightest, fastest login of set.
greytHR: [O] marketing = Gatsby 5.16 + DatoCMS; tenant login is per-company host (hrone.greythr.com -> invalid-account page, 2KB) so no generic login shell [U]. iOS 1 language, 4.62/116.
Darwinbox: [O] marketing Next.js + Storyblok + HubSpot; 719 requests/265 scripts on home; TikTok, LinkedIn, Bing, GA, Spara, SecurePrivacy CMP. App login is tenant-subdomain [U]. iOS store hit is white-label "Sembcorp HR" (20 languages) [O].
Zoho People/Accounts (accounts.zoho.com/signin) E-ZOHO-1
- [O] Server ZGS, jQuery 3.7.1 + xregexp + u2f-api, 6 scripts 134KB gz; HTML strings show OneAuth (68), TOTP, passkey/WebAuthn (35), SAML, Google/Apple/Yahoo/LinkedIn/Facebook/Twitter social, captcha; HSTS preload. iOS app 26 languages, 4.35/171.
- Richest public auth-option set (MFA/passkey/SSO).
BambooHR: [O] login.bamboohr.com not served on tested paths (bamboohr.com/login 404); site on Cloudflare with huge CSP (6sense, Clearbit, Convert, Datadog RUM, Clarity, Cloudinary). iOS 1 language, 4.66/12.7k ratings. App shell [U].
Rippling (app.rippling.com/login) E-RIP-1
- [O] React (id=app, webpack named chunks: appShell, products, pebble-packages = in-house design system "Pebble", lib-i18n, floating-ui, zxcvbn-ts, protobuf, auth-header). 17 script tags 2.4MB gz initial, 160 requests, 6 workers, 8 pings, SSE (eventsource) at login. Not module-federation (0 remoteEntry hits) [O]; domain-split chunk groups (products/finance, data/AIUsageDashboard) leak product names in route chunks [O].
- [O] Telemetry: Datadog RUM+logs, Sentry, Segment, LaunchDarkly, LogRocket, Transcend consent, AudioEye a11y overlay, Cloudflare Turnstile+reCAPTCHA, CSP report-only. SSO/Google/Apple options. PWA meta (apple-mobile-web-app-capable); manifest.json returns HTML [O]. iOS 1 language, 4.71/16.6k.
HiBob (app.hibob.com/login) E-BOB-1
- [O] Angular (ng-version, zone.js, <app-root>, module scripts runtime/polyfills/main, content-hash), 4 scripts 620KB gz, 39 requests, no workers; separate "login" bundle from main app (app-split by route family). Build id master-5cfe9049 exposed in URL + deployment-info.js.
- [O] CSP vendors: Descope (auth), LaunchDarkly, Pendo, Segment, Datadog EU, Zendesk, Mapbox, Filestack, VONQ, Vimeo. i18n.hibob.com translation host (4 req). dir="ltr" hard-coded. iOS 12 languages, 4.70/1.4k.
Personio: [O] login host returns 429 (Vercel); app.personio.de 401 to anonymous; shell [U]. iOS 18 languages, v2026.42.0, 33MB (smallest binary), only 10 ratings.
Factorial (app.factorialhr.com/users/sign_in) E-FAC-1
- [O] Rails (sign_in path, active_storage, actioncable wss) + Vite multi-entry: 91 script tags (~24MB gz transfer, medium confidence), REA: 322 requests/202 scripts/92 CSS, 8 workers, 34 failed. Entries named by product: billing, onboarding, enps, mcp_catalog, custom_resources, in_app_comms, upselling_kit, discover.
- [O] Telemetry: Datadog RUM+replay, Sentry, Grafana Faro, Amplitude, Clarity, Stripe, Intercom, Canny, Navattic, Google Translate widget, Cloudflare challenge. SSO flows via id.factorialhr.com. Heaviest login page of set; strongest counter-example.
Gusto: [O] Cloudflare managed challenge (cf-mitigated) on anonymous GET; not bypassed. Status page only. iOS 4.82/51.9k ratings (largest). Shell [U].
Deel (app.deel.com/login) E-DEEL-1
- [O] React + Vite (index-<hash>.js, modulepreload, "initialShared~index" shared chunk), served from S3+Cloudflare (public,max-age=60). REA: 163 requests, 113 scripts, 2 workers, PWA manifest.json 200. Fraud/device-fingerprint Sardine.ai, Coralogix RUM, GTM, Amplitude, Zendesk; i18n_rollout cookie {"sv","tr","hu","all"} = staged locale rollout [O]. iOS 1 language.
Bayzat: [O] Gatsby 5 marketing, 2 iOS languages, 4.59/32. App shell [U].
Jisr: [O] Next.js marketing, default Arabic (lang=ar, 3 rtl hits, 3 hreflang), iOS 1 language. App shell [U].
ZenHR: [O] Rails (x-runtime, ActionCable), jQuery-era CDN libs (TinyMCE, simplebar, xterm), /ar and /en locale paths; 1 script 3.5MB gz; 20+ marketing/analytics vendors in CSP (HubSpot, Hotjar, TikTok, Pendo, Userpilot, Chameleon, Calendly) [O]. Login offers Google/Microsoft. iOS 1 language.

## Cross-vendor patterns
| Dimension | Observation |
| Framework | React (Rippling, Deel), Angular (Bob), Rails+Vite (Factorial), ASP.NET MVC+jQuery (Keka), jQuery (Zoho), Rails (ZenHR). No micro-frontend/module-federation seen [O]. |
| Auth shell split | Bob, Keka, Zoho serve a tiny dedicated login bundle (134-620KB gz); Rippling/Factorial/Deel ship app-scale code on login. |
| Server-gated | Gusto, Personio, greytHR, Darwinbox, Bayzat, Jisr, Bamboo shells are tenant-bound or bot-gated [U]. |
| Auth options | Zoho passkey/WebAuthn/TOTP/SAML/social; Keka Google+MS; Rippling/ZenHR/Factorial SSO; Bob Descope. |
| i18n | iOS locales: Zoho 26, Darwinbox-wl 20, Personio 18, Keka 15, Bob 12; most others 1 (store metadata, not web). Arabic RTL only via Jisr, ZenHR (/ar), Deel staged rollout. |
| Telemetry | Datadog RUM (Rippling, Bob, Factorial, Bamboo), Sentry (Rippling, Factorial), LaunchDarkly (Rippling, Bob), Segment/Amplitude/Pendo/Clarity. Flags + RUM are table stakes. |
| PWA | Only Deel serves a manifest; no service worker evidence anywhere (workers = blob/analytics) [O]. |
| Source maps | None referenced in sampled bundles (Deel, Bob) [O]; not probed elsewhere [U]. |
| A11y | Only Rippling (AudioEye overlay) observed; no vendor publicly documents WCAG in shell [I]. |

## EMS comparison (EMS FE: Next 16, 6.2MB static, no dynamic imports, client-side auth guard, no i18n)
- 6.2MB static with no code-splitting is above Rippling (2.4MB gz initial ~ comparable raw) and far above Keka/Zoho/Bob login (<0.7MB gz). Adopt: split login/auth route group, next/dynamic per module, budget <300KB gz login.
- Client-side guard: no vendor evidence of server-gated shell, but Next middleware redirect avoids flash and bundle leak; Rippling leaks product names in chunk names, avoid.
- i18n + RTL: beat Keka/Bob baseline with next-intl, 3-5 locales incl. Arabic (GCC/MENA gap: Jisr, ZenHR, Bayzat weak), dir attribute, staged locale rollout cookie (Deel).
- Auth UX: add Google/Microsoft SSO, passkey/TOTP (Zoho is the benchmark), tenant-less login (EMS already email-resolves).
- Adopt: PWA manifest (only Deel), flag service (LaunchDarkly-like), RUM+Sentry, build-id/deployment-info for support, CSP (enforced, not report-only).
- Avoid: marketing trackers/replay on auth pages (Factorial 322 requests, Darwinbox 719).
Limits: single headless load per page from IN IP, no login, no store permission lists (Play pages not parsed) [U]; Chrome launched by REA itself, no leftover CDP process.
