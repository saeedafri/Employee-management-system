# HRMS competitor customer-pain mining
Date: 2026-10-17. Method: scripted pulls + WebFetch; keyword theme tagging (approximate, multi-label).

## 1. Sample sizes, sources, bias

- Google Play 1-2 star reviews, newest-first, en, US/IN/AE storefronts, up to 300 per app, text >25 chars: **3660** reviews across 23 vendor apps (fetched with google-play-scraper). Used for keyword theme counts. 98 curated short quotes below (Play, Trustpilot, HN); the Play ones were machine-verified as exact substrings, Trustpilot ones copied from WebFetch extraction (not independently re-verified).
- Trustpilot 1-2 star filter, first page (most recent ~12 per vendor), via WebFetch: BambooHR, Rippling, Gusto, Deel, Remote, HiBob, Personio, Factorial, Workday, greytHR(3), Paycor, Paylocity, Odoo, Zenefits, Bayzat(5), SAP(2), Lattice(2), Zoho (company-wide, not People). ~150 reviews read. Hand-tagged counts in section 3.
- Hacker News Algolia: ~770 unique comments fetched across 23 vendor names; yield very low (mostly off-topic: Deel/Remote/Lattice/Workday word collisions). 3 usable quotes.
- Web search snippets (secondary only): Capterra/CostBench aggregations on BambooHR/Rippling pricing; no verbatim Reddit obtained.
- Apple App Store RSS: endpoint returns zero entries for every app tested (US/IN/GB/AE); only Darwinbox returned 11. Effectively unusable, not counted.
- Bias: Play reviews skew to EMPLOYEE self-service mobile users (clock-in, payslips, login), not HR admins/buyers. Trustpilot skews to small-business/payroll disputes and is unverified; Trustpilot scores vary wildly by whether vendor invites reviews (Deel 4.6/9,669 vs Gusto 1.9/2,540 vs Paylocity 1.2/132 vs Workday 1.1/506, where Workday reviews are mostly job-applicant portal rage, not employer HR). Gusto Play app = Gusto Wallet (com.gusto.money), not the main product. Play counts are a negative-only sample; do not compare to satisfaction rates. Keyword tagging overcounts generic words (e.g. 'error', 'login'). Thin samples: Remote 31, Factorial 27, Lattice 33, Bayzat 41, Personio 91 Play; Darwinbox/ZenHR/Sage HR/Keka/Jisr have 0 Trustpilot text.

## 2. Per-vendor theme counts: Google Play 1-2 star (keyword-tagged, multi-label)

| Vendor | n | payroll errors | support | pricing/fees | customization | reporting | leave/attendance | mobile app | performance/slow | integrations | onboarding/impl | compliance | UX | data export/lock-in | downtime/bugs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Gusto | 277 | 66 | 26 | 16 | 0 | 4 | 61 | 27 | 35 | 3 | 2 | 7 | 21 | 33 | 74 |
| Paylocity | 263 | 33 | 5 | 3 | 2 | 1 | 75 | 12 | 50 | 4 | 10 | 4 | 36 | 37 | 75 |
| Paycor | 262 | 12 | 5 | 7 | 2 | 2 | 56 | 31 | 50 | 7 | 1 | 1 | 24 | 15 | 142 |
| Workday | 252 | 13 | 2 | 6 | 0 | 2 | 32 | 21 | 40 | 3 | 5 | 5 | 53 | 12 | 110 |
| BambooHR | 239 | 15 | 5 | 4 | 0 | 1 | 52 | 12 | 28 | 2 | 6 | 6 | 17 | 21 | 61 |
| SuccessFactors | 235 | 35 | 6 | 2 | 1 | 0 | 20 | 12 | 57 | 4 | 3 | 2 | 15 | 1 | 80 |
| Keka | 220 | 10 | 8 | 5 | 1 | 3 | 86 | 18 | 40 | 4 | 1 | 1 | 10 | 24 | 81 |
| Rippling | 199 | 16 | 14 | 13 | 3 | 2 | 46 | 15 | 44 | 5 | 3 | 4 | 28 | 26 | 67 |
| Deel | 192 | 9 | 28 | 13 | 1 | 3 | 7 | 19 | 80 | 0 | 1 | 2 | 21 | 3 | 59 |
| HiBob | 188 | 0 | 6 | 8 | 0 | 1 | 27 | 19 | 47 | 2 | 0 | 0 | 13 | 3 | 61 |
| greytHR | 172 | 12 | 5 | 5 | 0 | 3 | 26 | 6 | 47 | 2 | 0 | 3 | 8 | 0 | 62 |
| ZohoPeople | 166 | 5 | 6 | 3 | 2 | 2 | 52 | 12 | 24 | 4 | 3 | 5 | 15 | 4 | 58 |
| Odoo | 164 | 1 | 28 | 15 | 1 | 2 | 7 | 6 | 24 | 4 | 8 | 6 | 21 | 1 | 56 |
| SageHR | 158 | 27 | 3 | 1 | 2 | 0 | 2 | 4 | 16 | 0 | 2 | 0 | 10 | 0 | 70 |
| Darwinbox | 144 | 3 | 2 | 5 | 0 | 3 | 23 | 17 | 36 | 0 | 0 | 5 | 18 | 1 | 52 |
| Zenefits | 122 | 5 | 7 | 3 | 0 | 0 | 26 | 5 | 24 | 3 | 2 | 2 | 9 | 11 | 45 |
| Jisr | 103 | 7 | 0 | 1 | 1 | 0 | 38 | 4 | 14 | 0 | 0 | 3 | 3 | 3 | 17 |
| Personio | 91 | 0 | 5 | 1 | 2 | 1 | 13 | 6 | 9 | 2 | 6 | 2 | 7 | 1 | 31 |
| ZenHR | 81 | 3 | 3 | 0 | 0 | 0 | 12 | 5 | 13 | 0 | 0 | 2 | 5 | 4 | 26 |
| Bayzat | 41 | 1 | 4 | 3 | 0 | 1 | 14 | 2 | 8 | 1 | 0 | 1 | 4 | 1 | 11 |
| Lattice | 33 | 0 | 0 | 1 | 0 | 0 | 1 | 1 | 1 | 5 | 1 | 1 | 4 | 0 | 8 |
| Remote | 31 | 3 | 8 | 2 | 0 | 0 | 1 | 1 | 2 | 1 | 1 | 0 | 3 | 0 | 6 |
| Factorial | 27 | 0 | 3 | 2 | 0 | 0 | 6 | 2 | 6 | 0 | 1 | 2 | 2 | 2 | 14 |

Aggregate Play hits: downtime/bugs 1266, performance/slow 695, leave/attendance 683, UX 347, payroll errors 276, mobile app 257, data export/lock-in 203, support 179, pricing/fees 119, compliance 64, onboarding/impl 56, integrations 56, reporting 31, customization 18 (of 3660 reviews).

## 3. Per-vendor theme counts: Trustpilot 1-2 star (hand-tagged on the ~12 most recent each; multi-label)

- **BambooHR (n=12)**: support 3, UX/complexity 2, leave/attendance 1, billing/collections 1, customization 1, localisation 1
- **Rippling (11)**: support 5, pricing 1, cancel/lock-in 1, bugs/lockout 2, mid-build product 1, timesheet loses data 1
- **Gusto (12)**: payroll errors/lateness 5, support 5, onboarding 1
- **Deel (12)**: payroll errors 4, support 3, outages/auth 2, localisation (Canada) 1, funds delay 1, mobile 1
- **Remote (12)**: support 4, payroll/payout errors 3, fees/billing 3, payout delay 2
- **HiBob (12)**: sales over-promise 3, cancel/support silence 3, outages 3, manual work 1, data deletion 1
- **Personio (12)**: pricing 4, support 4, bugs/outages 1, missing features 2, tax-doc errors 1, privacy/scraping 1, implementation 1
- **Factorial (12)**: support 6, pricing/billing 4, bugs 3, manual work 1
- **Workday (12)**: UX 6, bugs 4, payroll edit 1 (mostly candidate portal)
- **greytHR (3)**: support 3, implementation gaps 1
- **Paycor (12)**: support 4, overbilling 4, trust 4
- **Paylocity (12)**: support 6, clock-in/missed punch 2, pricing 1, FSA 2
- **Odoo (12)**: bugs/updates 4, support 3, sales/implementation 3, pricing 1
- **Zenefits (12)**: support 3, payroll 1, billing 2, post-acquisition decline 1, contract lock 1
- **Bayzat (5)**: claims/support 3, implementation delay 1
- **SAP/SuccessFactors (2)**: UX 1, fake postings 1
- **Lattice (2)**: too many features 1, buggy performance review 1
- **Darwinbox, ZenHR, Sage HR**: 0 reviews on Trustpilot
- **Keka, Jisr**: Trustpilot page 404
- **Zoho People**: only company-wide Zoho page (UX, support, data loss); no People-specific text

## 4. Cross-vendor ranked unmet needs (evidence = Play keyword hits + Trustpilot hand tags + verbatim quotes)

### 1. Reliable attendance/clock-in/leave workflow (offline, geofence, regularisation, mobile)

- Paycor | Play | 1* | 2026-06-23 | "Can't punch in, offline punches don't sync" | https://play.google.com/store/apps/details?id=com.paycor.perform&reviewId=8fdbd60c-5614-4b9e-a698-f93fa09c0cac
- Keka | Play | 1* | 2026-06-30 | "The Clock In option is not showing on the mobile app, so I'm unable to mark my attendance" | https://play.google.com/store/apps/details?id=com.keka.xhr&reviewId=93c565c1-1565-4b7c-bd6d-92d22ea5b14b
- Paylocity | Play | 1* | 2026-10-09 | "kept saying system error system error not in the system when I've clearly been checking in" | https://play.google.com/store/apps/details?id=com.paylocity.paylocitymobile&reviewId=624485d1-ff4c-48c7-b978-42ff9bc3e4f6
- Deel | Play | 1* | 2026-05-04 | "clocking hours for the day has been hidden in a nother section with no notice given" | https://play.google.com/store/apps/details?id=com.deel.app&reviewId=17e439d9-a094-4554-a99d-338ddd5a4dd8
- Workday | Play | 2* | 2026-09-25 | "will not let you make changes up unless you have a full punch" | https://play.google.com/store/apps/details?id=com.workday.workdroidapp&reviewId=5d987c8a-1d05-45af-b292-40780abe5195
- Personio | Play | 1* | 2025-05-27 | "The most basic function of entering attendance times is designed not for human." | https://play.google.com/store/apps/details?id=com.personio&reviewId=4afe92cd-2503-481a-b4ee-47aad44e3c72
- HiBob | Play | 2* | 2025-04-29 | "clocking in and out, and it frequently crashes" | https://play.google.com/store/apps/details?id=com.hibob&reviewId=aff6dc1e-524c-44c4-89ac-7a4a3ffa5b90
- ZohoPeople | Play | 2* | 2019-03-20 | "checkin and check-out not in sync and not reliable" | https://play.google.com/store/apps/details?id=com.zoho.people&reviewId=5360ba13-85f1-4315-986d-789eb28e0cfd
- BambooHR | Trustpilot | 1* | 2026-07-29 | "the time and attendance module is horrendous." | https://www.trustpilot.com/review/bamboohr.com?stars=1&stars=2
- Paylocity | Trustpilot | 2* | 2026-08-31 | "At least 4 times a week Paylocity says I missed a punch." | https://www.trustpilot.com/review/paylocity.com?stars=1&stars=2

### 2. Login stability, uptime, no forced re-auth

- Keka | Play | 1* | 2026-09-22 | "The Captcha is taking around 20–30" | https://play.google.com/store/apps/details?id=com.keka.xhr&reviewId=ab94a8fa-f6fa-484a-b41a-a46ba605f75d
- Personio | Play | 1* | 2026-06-03 | "whenever you use the website you need to login AGAIN. EVERY SINGLE DAY." | https://play.google.com/store/apps/details?id=com.personio&reviewId=9afbe30c-abe6-40b4-a0ec-534fcf0a14e0
- Deel | Play | 1* | 2025-12-26 | "I have been facing login issues for the past 3 weeks" | https://play.google.com/store/apps/details?id=com.deel.app&reviewId=a2b7fc6b-4818-4dc4-bf81-82734fd0975d
- Paycor | Play | 2* | 2026-04-25 | "can't log into the app" | https://play.google.com/store/apps/details?id=com.paycor.perform&reviewId=7e161fe2-429b-4221-a1c6-5a1e85dcbe5b
- Darwinbox | Play | 1* | 2026-08-02 | "Logs me out almost twice/thrice a week" | https://play.google.com/store/apps/details?id=com.darwinbox.darwinbox&reviewId=512f94a1-39c8-4fa4-8f6d-f62482effcaf
- Gusto | Play | 1* | 2026-02-20 | "it will not get past the loading screen" | https://play.google.com/store/apps/details?id=com.gusto.money&reviewId=5bdca594-dd9e-4ebd-9181-26ea889e5207
- Deel | Trustpilot | 1* | 2026-10-15 | "Between the outages, issues with Auth/Identity, I can't recommend Deel to anyone." | https://www.trustpilot.com/review/deel.com?stars=1&stars=2
- HiBob | Trustpilot | 1* | 2025-07-28 | "Frequent errors and system downtime have caused major disruptions" | https://www.trustpilot.com/review/hibob.com?stars=1&stars=2
- Personio | Trustpilot | 1* | 2025-01-31 | "it's plagued by constant bugs and frequent outages" | https://www.trustpilot.com/review/personio.com?stars=1&stars=2
- Factorial | Trustpilot | 1* | 2025-06-20 | "Virtually nothing works for longer than a couple of days" | https://www.trustpilot.com/review/factorialhr.com?stars=1&stars=2

### 3. Reachable human support with real SLA

- Rippling | Trustpilot | 1* | 2026-09-12 | "No way to call, no live chat, no help at all." | https://www.trustpilot.com/review/rippling.com?stars=1&stars=2
- BambooHR | Trustpilot | 1* | 2026-06-17 | "You are not able to speak to a human over the phone." | https://www.trustpilot.com/review/bamboohr.com?stars=1&stars=2
- Gusto | Trustpilot | 1* | 2026-09-21 | "It takes at least five calls to get anything taken care of." | https://www.trustpilot.com/review/gusto.com?stars=1&stars=2
- Paylocity | Trustpilot | 1* | 2026-08-06 | "My hold time was 42 minutes and I finally hung up." | https://www.trustpilot.com/review/paylocity.com?stars=1&stars=2
- Factorial | Trustpilot | 1* | 2025-08-04 | "Its impossible to get support. They seem to hide behind bots" | https://www.trustpilot.com/review/factorialhr.com?stars=1&stars=2
- Remote | Trustpilot | 1* | 2026-09-16 | "the system will not allow me to speak to an actual human." | https://www.trustpilot.com/review/remote.com?stars=1&stars=2
- Rippling | Play | 1* | 2025-07-30 | "it's been 15 days and never got one response" | https://play.google.com/store/apps/details?id=com.people.rippling&reviewId=abb5004c-4ac5-4f38-8108-de6c3a0f075c
- Keka | Play | 2* | 2020-04-28 | "Keka does not provide support directly to employees" | https://play.google.com/store/apps/details?id=com.keka.xhr&reviewId=f6e3d702-07c7-4942-8c4f-1fd932c2201c
- Bayzat | Play | 1* | 2023-07-04 | "an agent answering you after 5 hrs with no definite update" | https://play.google.com/store/apps/details?id=com.bayzat.benefits&reviewId=76443a6b-8eb3-4d14-aefc-4b3e2615d310
- Paylocity | Play | 2* | 2026-05-26 | "live customer service support are not available to employees" | https://play.google.com/store/apps/details?id=com.paylocity.paylocitymobile&reviewId=4bc3af05-bf6c-4a2c-8122-06619842b4cc
- Zoho People | HN | n/a* | 2018-09-24 | "Zoho customer support is worse than useless." | https://news.ycombinator.com/item?id=18061142

### 4. Correct, on-time payroll with self-service correction

- Deel | Trustpilot | 1* | 2026-10-14 | "Deel incorrectly processed my salary for two consecutive months" | https://www.trustpilot.com/review/deel.com?stars=1&stars=2
- Deel | Trustpilot | 2* | 2026-10-13 | "When processing payroll we must reject it at least once every time due to errors on the DEEL side." | https://www.trustpilot.com/review/deel.com?stars=1&stars=2
- Remote | Trustpilot | 1* | 2026-07-21 | "Yet ANOTHER payroll error from Remote." | https://www.trustpilot.com/review/remote.com?stars=1&stars=2
- Gusto | Trustpilot | 1* | 2026-10-16 | "Its a regular occurrence for payroll to not arrive on time." | https://www.trustpilot.com/review/gusto.com?stars=1&stars=2
- Gusto | Trustpilot | 1* | 2026-10-10 | "Their system prevents you from correcting your own payroll, forcing you to contact customer support." | https://www.trustpilot.com/review/gusto.com?stars=1&stars=2
- Personio | Trustpilot | 1* | 2026-05-05 | "incorrect data in official tax documents" | https://www.trustpilot.com/review/personio.com?stars=1&stars=2
- Zenefits | Trustpilot | 1* | 2025-05-09 | "Numerous mistakes and no way of contacting them directly." | https://www.trustpilot.com/review/zenefits.com?stars=1&stars=2
- Workday | Trustpilot | 1* | 2026-10-07 | "I have been trying to edit my payroll information for four months now!" | https://www.trustpilot.com/review/workday.com?stars=1&stars=2
- Gusto | Play | 1* | 2025-12-10 | "deposited my paycheck into the wrong account" | https://play.google.com/store/apps/details?id=com.gusto.money&reviewId=ad5ed22a-fe7f-43c3-9e78-78210e16c7eb

### 5. Fast, lightweight app/web

- Gusto | Play | 2* | 2026-03-04 | "app takes forever to load" | https://play.google.com/store/apps/details?id=com.gusto.money&reviewId=d07ebf27-2fb1-43c8-9fa4-a36a347d10c9
- SuccessFactors | Play | 1* | 2026-09-06 | "this app is slow as hell" | https://play.google.com/store/apps/details?id=com.successfactors.successfactors&reviewId=56b5db6e-4779-4b56-97b7-136ce6a34a31
- Deel | Play | 2* | 2025-10-19 | "+3GB. Definitely not worth downloading" | https://play.google.com/store/apps/details?id=com.deel.app&reviewId=77b91e19-caf8-470d-9228-33c84b44bcb5
- greytHR | Play | 2* | 2026-03-31 | "need to improve lagging to use app" | https://play.google.com/store/apps/details?id=com.greytip.ghress&reviewId=d887a3bd-8dcb-4d57-8e98-544e72bde46c
- Factorial | Play | 1* | 2025-10-15 | "so slow & buggy. hard to use. freezes constantly" | https://play.google.com/store/apps/details?id=com.factorialhr.factorialapp&reviewId=8eb6f276-758b-487b-86d7-d6c0aa4b5601
- BambooHR | Play | 1* | 2025-12-28 | "slow and bloated" | https://play.google.com/store/apps/details?id=com.mokinetworks.bamboohr&reviewId=c170f12f-5e79-44ea-affb-68c2b2adcc08
- greytHR | Play | 1* | 2026-09-30 | "App takes 25 seconds to load" | https://play.google.com/store/apps/details?id=com.greytip.ghress&reviewId=11d4a422-eac4-4570-9c6b-793d21f7e218

### 6. Transparent, non-escalating pricing / no per-seat surprises

- Rippling | Trustpilot | 1* | 2026-09-21 | "a proposal containing $44 per user per month" | https://www.trustpilot.com/review/rippling.com?stars=1&stars=2
- Remote | Trustpilot | 1* | 2026-09-03 | "They take 2.5-3.5% of your salary in commission" | https://www.trustpilot.com/review/remote.com?stars=1&stars=2
- Personio | Trustpilot | 1* | 2025-03-13 | "We're forced to pay for 50% more licenses than needed, with no option to adjust." | https://www.trustpilot.com/review/personio.com?stars=1&stars=2
- Factorial | Trustpilot | 1* | 2025-10-21 | "my subscription price doubled without any prior notice or consent." | https://www.trustpilot.com/review/factorialhr.com?stars=1&stars=2
- Zenefits | Trustpilot | 1* | 2023-04-13 | "We have a team of 6 people. Zenefits charges us for 13 people." | https://www.trustpilot.com/review/zenefits.com?stars=1&stars=2
- Odoo | Trustpilot | 1* | 2026-10-12 | "your price will be raise more than 50% in the following years" | https://www.trustpilot.com/review/odoo.com?stars=1&stars=2
- Paycor | Trustpilot | 1* | 2026-09-02 | "They constantly over charge you" | https://www.trustpilot.com/review/paycor.com?stars=1&stars=2
- BambooHR | Trustpilot | 1* | 2026-07-23 | "They later sent both invoices, totalling $850, to a collection agency." | https://www.trustpilot.com/review/bamboohr.com?stars=1&stars=2

### 7. Simple UX / few clicks for core tasks

- Workday | Trustpilot | 1* | 2026-09-25 | "Requesting a day off takes six menus and a prayer." | https://www.trustpilot.com/review/workday.com?stars=1&stars=2
- BambooHR | Trustpilot | 1* | 2026-10-12 | "BambooHR is by far the most complicated system to use." | https://www.trustpilot.com/review/bamboohr.com?stars=1&stars=2
- Remote | Trustpilot | 2* | 2026-08-08 | "Very complicated, too much questions and rules to follow" | https://www.trustpilot.com/review/remote.com?stars=1&stars=2
- Rippling | Play | 1* | 2026-10-15 | "too many steps to get a simple edit on a timecard" | https://play.google.com/store/apps/details?id=com.people.rippling&reviewId=b9e126e2-45ed-4a4b-8af6-27dea0c891af
- Workday | Play | 1* | 2026-09-28 | "the site mapping is so confusing" | https://play.google.com/store/apps/details?id=com.workday.workdroidapp&reviewId=f83a44c5-7045-4948-95e4-ff805df11e8b
- Factorial | Play | 1* | 2025-10-15 | "hard to use" | https://play.google.com/store/apps/details?id=com.factorialhr.factorialapp&reviewId=8eb6f276-758b-487b-86d7-d6c0aa4b5601

### 8. Payslip/salary-certificate access that works

- ZenHR | Play | 1* | 2024-11-27 | "No payslip access, no cumulative salary update, employment date is wrong, no salary certificate" | https://play.google.com/store/apps/details?id=com.zenhr&reviewId=3b82a602-ad24-4a25-b312-18e9c9abc144
- greytHR | Play | 2* | 2025-11-10 | "salary slip not showing" | https://play.google.com/store/apps/details?id=com.greytip.ghress&reviewId=c8c86b3d-4c43-4b08-96d6-9a0cb139b9e1
- Keka | Play | 2* | 2026-02-16 | "my payslip option is missing" | https://play.google.com/store/apps/details?id=com.keka.xhr&reviewId=488ce87a-9925-40d2-9288-0903b761b554
- Jisr | Play | 1* | 2025-07-01 | "After update salary is not showing." | https://play.google.com/store/apps/details?id=ess.android&reviewId=2379d040-e01e-497f-a4c3-764b27cf0f05
- ZohoPeople | Play | 1* | 2022-08-09 | "payslips and letters are not showing in application" | https://play.google.com/store/apps/details?id=com.zoho.people&reviewId=776d3cc9-fe71-4ce1-8b0c-21163dc4fd20

### 9. Updates that do not break core flows

- Deel | Play | 2* | 2026-02-19 | "latest update broke it completely" | https://play.google.com/store/apps/details?id=com.deel.app&reviewId=80c55b24-3005-47ce-b964-5d629c4a173c
- Rippling | Play | 2* | 2025-09-26 | "your new update made it so I can not add my time" | https://play.google.com/store/apps/details?id=com.people.rippling&reviewId=7d8a4342-0e45-41cb-a6f2-e949f619f73b
- Darwinbox | Play | 1* | 2026-08-19 | "Recent Updated Version is not satisfactory it always crash" | https://play.google.com/store/apps/details?id=com.darwinbox.darwinbox&reviewId=4e6e1621-c763-4ec3-add9-67a13250571f
- Darwinbox | Play | 1* | 2026-08-02 | "After the redesign, app has become a major hassle" | https://play.google.com/store/apps/details?id=com.darwinbox.darwinbox&reviewId=512f94a1-39c8-4fa4-8f6d-f62482effcaf

### 10. Easy cancel, data export, no lock-in

- Rippling | Trustpilot | 1* | 2026-09-09 | "spent a month trying to cancel and they wouldn't let me" | https://www.trustpilot.com/review/rippling.com?stars=1&stars=2
- HiBob | Trustpilot | 1* | 2025-02-09 | "I have asked HiBob to cancel our subscription 5 times and no one has responded." | https://www.trustpilot.com/review/hibob.com?stars=1&stars=2
- Personio | Trustpilot | 2* | 2025-09-01 | "after the cancelation, they doesn't reply to any email" | https://www.trustpilot.com/review/personio.com?stars=1&stars=2
- HiBob | Trustpilot | 1* | 2025-10-28 | "all of our historical Pento data appears to have been deleted without any notification" | https://www.trustpilot.com/review/hibob.com?stars=1&stars=2
- Zenefits | Trustpilot | 1* | 2023-07-07 | "I'm stuck in this contract for awhile" | https://www.trustpilot.com/review/zenefits.com?stars=1&stars=2
- Paycor | Trustpilot | 1* | 2026-07-23 | "They will drain your account by billing you even after you escape" | https://www.trustpilot.com/review/paycor.com?stars=1&stars=2

### 11. Honest sales promises and quick implementation

- HiBob | Trustpilot | 1* | 2026-09-22 | "they told us the system could do a variety of things that it cannot." | https://www.trustpilot.com/review/hibob.com?stars=1&stars=2
- Rippling | Trustpilot | 1* | 2026-08-31 | "sold us an airplane that we were unaware was being built mid-flight" | https://www.trustpilot.com/review/rippling.com?stars=1&stars=2
- Bayzat | Trustpilot | 1* | 2024-06-30 | "promised the moon with features and after full payment of a year, it took them 4 months for implementation" | https://www.trustpilot.com/review/bayzat.com?stars=1&stars=2
- Personio | Trustpilot | 1* | 2025-08-05 | "THEY KEPT ON INCRESING THE TIMELINE AND EXTENDING THE SERVICE" | https://www.trustpilot.com/review/personio.com?stars=1&stars=2
- Odoo | Trustpilot | 1* | 2026-07-23 | "We never received the qualified project management and support we needed" | https://www.trustpilot.com/review/odoo.com?stars=1&stars=2
- greytHR | Trustpilot | 2* | 2018-07-05 | "Lot of things are missing that you will know during implementation only." | https://www.trustpilot.com/review/greythr.com?stars=1&stars=2

### 12. Integrations and less manual duplicate entry

- HiBob | Trustpilot | 1* | 2026-07-01 | "Many core hiring tasks require manual updates, duplicate data entry, and workarounds" | https://www.trustpilot.com/review/hibob.com?stars=1&stars=2
- Factorial | Trustpilot | 2* | 2025-05-14 | "Creates manual work rather than eliminating it." | https://www.trustpilot.com/review/factorialhr.com?stars=1&stars=2
- Rippling | Play | 1* | 2025-08-11 | "integrations don't work" | https://play.google.com/store/apps/details?id=com.people.rippling&reviewId=58558634-c942-4ba0-bf83-b5af41f8771b
- Odoo | Play | 1* | 2025-05-12 | "i have been trying to integrate Razorpay but it's not working" | https://play.google.com/store/apps/details?id=com.odoo.mobile&reviewId=2fa98237-2285-4f3b-8000-4ec8e8d3d6b2
- Paycor | Play | 1* | 2026-07-01 | "no ability to see full team schedules, no ability for non-Sick day time off" | https://play.google.com/store/apps/details?id=com.paycor.perform&reviewId=9f1f83e6-510c-45dd-9236-449cfd7ac44a

### 13. Notifications for approvals, failed payouts, check-ins

- ZohoPeople | Play | 1* | 2023-07-14 | "have a popup notification for the check ins" | https://play.google.com/store/apps/details?id=com.zoho.people&reviewId=55bcdef4-642c-43e0-8394-e17597fe1a64
- Workday | Play | 2* | 2026-08-07 | "a notification of some sort of a required log in would be nice" | https://play.google.com/store/apps/details?id=com.workday.workdroidapp&reviewId=255cc4bd-211c-4907-bd60-19ce07ea107b
- Personio | Play | 2* | 2022-11-10 | "won't even show you pending absence requests" | https://play.google.com/store/apps/details?id=com.personio&reviewId=8977db50-65a9-4f93-8b6e-c5bf58fdcac0
- Remote | Trustpilot | 1* | 2026-10-07 | "when my payout failed, Remote didn't even notify me. No email, no notification, nothing." | https://www.trustpilot.com/review/remote.com?stars=1&stars=2

### 14. Local-market compliance (country rules, privacy)

- Deel | Trustpilot | 1* | 2026-10-15 | "the product simply is not set up for the realities of a Canadian employee" | https://www.trustpilot.com/review/deel.com?stars=1&stars=2
- Personio | Trustpilot | 1* | 2025-11-25 | "Personio has obtained my personal telephone number through web scraping" | https://www.trustpilot.com/review/personio.com?stars=1&stars=2

### 15. Useful reporting/dashboards

- Keka | Play | 2* | 2024-09-06 | "In dashboard it should be also mention the no of count of regularization" | https://play.google.com/store/apps/details?id=com.keka.xhr&reviewId=6f5c254a-5932-4068-8145-40413f761d46
- HiBob | Play | 2* | 2023-09-13 | "It's very basic application" | https://play.google.com/store/apps/details?id=com.hibob&reviewId=6fb55618-fa47-4d5d-a70d-446e253b9f44
- Zenefits | Trustpilot | 1* | 2024-04-30 | "hundreds of confusing reportings" | https://www.trustpilot.com/review/zenefits.com?stars=1&stars=2

### 16. Flexible workflows/config

- Deel | HN | n/a* | 2025-03-19 | "any exceptions to the rigid workflow breaks the entire process" | https://news.ycombinator.com/item?id=43407663
- BambooHR | Trustpilot | 1* | 2026-03-18 | "the double blind assessment function that can not be disabled" | https://www.trustpilot.com/review/bamboohr.com?stars=1&stars=2

## 5. Complaints EMS can directly turn into advantages

- Attendance/leave: EMS already ships check-in/out, regularization with approve/deny, today status, team records, monthly calendar. Differentiate on offline punch queue + visible sync state, in-app 'missed punch' regularization in one tap, and manager pending-request visibility (Personio/Zoho complaint).
- Payroll correctness: payroll engine with semi-monthly proration, statutory packs, KWD 3-decimal tenant. Market: self-serve correction after submit (Gusto), approved raise not applied (Deel), tax-doc errors (Personio). Offer pre-run diff/variance check, unlock-and-recalculate before lock, immutable audit trail.
- Payslips + salary certificate: ZenHR, greytHR, Keka, Jisr, Zoho reviews all say payslip missing after update. Make payslip per-run read a first-class, regression-tested endpoint.
- Support/transparency: self-hosted multi-tenant means named contact + in-product audit logs; promise human reachability. Biggest cross-vendor Trustpilot theme (BambooHR, Rippling, Factorial, Paylocity, Gusto).
- Pricing: flat/per-tenant or published tiers, price-lock clause; attack per-seat inflation (Personio licences +50%, Zenefits billing 13 for 6, Factorial doubling).
- Lock-in: Cancel + full export (CSV/XLSX export already exists) + documented data-retention; HiBob/Pento data deletion and Rippling cancel complaints.
- Stability: no forced re-login (refresh rotation exists), lightweight PWA/web, changelog and non-breaking updates; keep health checks and a status page.
- Notifications: SSE/in-app notification stream exists; add failed-payout and approval pushes (Remote, Workday, Zoho asks).
- Regional fit: Gulf (WPS, GOSI, gratuity) and India (PF/ESI) coverage: Jisr/ZenHR/Keka reviews show payroll/payslip gaps; Deel Canada gap shows localisation demand. No hardcoded country logic is already an EMS rule.

## 6. Unreachable / low-yield sources
- Blocked (403): TrustRadius, Software Advice, GetApp, Capterra, Gartner Peer Insights, old.reddit.com (curl 'Blocked'; WebFetch not attempted on Reddit .json). Trustpilot via curl 403 but works via WebFetch.
- Trustpilot 404: keka.com, jisr.net; empty: Darwinbox, ZenHR, Sage HR.
- Apple RSS reviews: empty for tested apps.
- community.keka.com: JS shell, no content. Not tried: help.zoho.com forums, BambooHR community, Quora (low priority).
- WebSearch returned no Reddit threads; only aggregator/vendor blog snippets (treated as secondary, not quoted as verbatim).