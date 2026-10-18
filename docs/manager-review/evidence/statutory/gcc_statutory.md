# GCC statutory payroll rules — verification (as of 2026-10-17)

Method: official portals mostly unreachable from the sandbox (manpower.gov.kw, mohre.gov.ae, gosi.gov.sa JS-only/ECONNREFUSED; pifss.gov.kw home has no rates). Used: regulator-published PDFs (Qatar CBQ/QCB SIF spec; DDA = Dubai govt UAE law summary; Kuwait "Worker's Guide" 2022, Kuwaiti Centre for Studies, cites each article of Law 6/2010), PwC Worldwide Tax Summaries, EY tax alert, Mercans/Teamed statutory alerts. Confidence: PRIMARY = regulator/government text or spec directly read; SECONDARY = >=2 reputable summaries agree; CONFLICTING = sources disagree; UNVERIFIED = not found / from memory.

## KUWAIT
| Rule | Value | Cite | Conf |
|---|---|---|---|
| PIFSS (Kuwaiti nationals only; expats exempt) | Per-fund: Basic 10% ER / 5% EE, ceiling KD 1,500; Supplementary 10% / 5%, ceiling KD 1,250; Pension-increase 1% ER / 2.5% EE, ceiling KD 2,750; Unemployment (private+oil) 0.5% / 0.5%, ceiling KD 2,750; Financial remuneration 0% / 2.5%, ceiling KD 1,500, for 18 yrs. Law 61/1976 | teamed.global/gulf-employment-law/kuwait-payroll-and-social-security (paraphrasing PIFSS) | SECONDARY (PIFSS site itself not retrievable) |
| Headline PIFSS | ER 11.5% / EE 8% (+2.5% EE since 1 Jan 2015, ceiling KD 1,500); ceiling KD 2,750 | PwC taxsummaries.pwc.com/kuwait/individual/other-taxes | CONFLICTING: KPMG 2023 says EE 10.5%; fund-level table sums differently (ER 21.5% vs 11.5%). Do NOT hardcode headline; model per-fund. |
| PIFSS minimum | no source for KD 125 floor; KUNA 2024: "no changes to current social insurance laws" | kuna.net.kw id=3183291 | UNVERIFIED |
| EOS indemnity (Art 51) monthly-paid | 15 days wage per year first 5 yrs, 1 month per year after; total cap 1.5 yrs wage. Daily/weekly/hourly: 10 days / 15 days, cap 1 yr | Law 6/2010 Art 51, via Worker's Guide p26 (kuwaithr.org/setup/media_files/news_backPeak/kvKX5Sp_2024-09-11.pdf) | PRIMARY-ish (govt-affiliated guide quoting article) + 4 calculator sites agree |
| Resignation tiers (Art 53), indefinite contract | <3y: 0; 3-<5y: 1/2; 5-<10y: 2/3; >=10y: full. Same tiers when worker deemed resigned (Art 42) | Art 53 / Art 42 | PRIMARY-ish. PwC's "expat indemnity after 3 yrs, 15d then 2/3 month" is the OLD law -> stale |
| Wage definition | basic + contractual elements + regular allowances/bonuses (Art 55) -> indemnity base = last wage | Art 55 | PRIMARY-ish |
| Notice | monthly-paid: 3 months; others 1 month; pay in lieu = wage for period (Art 44) | Art 44 | PRIMARY-ish (guide excerpt); verify months |
| Probation | max 100 days, no notice | Art 33 | PRIMARY-ish |
| Hours | 8/day, 48/week; Ramadan 36/week (Art 64); break 1h per 5h (Art 65) | Art 64-65 | PRIMARY-ish |
| Overtime | written order; max 2h/day, 180h/yr, 3 days/wk, 90 days/yr; +25% ordinary day; rest day +50% + comp day; official holiday 100% + comp day (Art 66-68) | Art 66-68 | PRIMARY-ish |
| Sick leave (Art 69) | 15d full, 10d 75%, 10d 50%, 10d 25%, 30d unpaid | Art 69 | PRIMARY-ish |
| Annual leave (Art 70-73) | 30 days paid; eligible after 6 months (Worker's Guide) vs 9 months (parliament.am copy) | Art 70 | CONFLICTING (6 vs 9 months); 35-day draft reported, status unknown |
| Min wage | KD 75/month | Ministerial Res 14/2017 | PRIMARY-ish |
| Wage payment | within 7 days of due (Art 56); employers with >=5 workers must bank-transfer (Art 57 as amended Law 32/2016); deductions: 10% for loans (Art 59a), 25% cap other debts | Art 56/57/59 | SECONDARY (PIFSS page + Worker's Guide agree) |
| KWPS/Ashal | CBK Kuwait Wage Payment System, PAM-enforced; dates/scope vary (Nov 2025 / Sept 2026) | envoyglobal, visasupdate | CONFLICTING/UNVERIFIED; no public file spec found |
| Kuwaitization quotas | no current % found | - | UNVERIFIED |

## UAE
| Rule | Value | Cite | Conf |
|---|---|---|---|
| Gratuity | 21 days basic wage/yr first 5 yrs; 30 days/yr after; cap 24 months basic; needs >=1 yr continuous service; 30-day month; applies to resignation and termination (FDL 33/2021 Art 51, Cab Res 1/2022) | DDA summary PDF dda.gov.ae/-/media/A723B420E7B847B3B104C6AAB8CF937F.pdf (govt) + afridi-angell, teamed | PRIMARY-ish. Cap and 1-yr minimum from secondary only. |
| Notice | min 30, max 90 days written (Art 43) | DDA summary | PRIMARY-ish |
| Probation | <=6 months, 14 days notice | DDA | PRIMARY-ish |
| Overtime | max 2h/day; +25% basic; 10pm-4am +50%; rest day/holiday +50% or day off | DDA | PRIMARY-ish |
| Hours | 48/wk | DDA | PRIMARY-ish |
| Annual leave | 2d/month after 6 months; 30 d/yr after 1 yr; encash unused on exit on basic | DDA | PRIMARY-ish |
| Sick leave | 90 d/yr after probation: 15 full, 30 half, rest unpaid | DDA | PRIMARY-ish |
| Final settlement | within 14 days of last day (Art 53) | uaeahead/others | SECONDARY |
| WPS | Ministerial Res 0340/2026 (issued 12 May 2026, eff 1 Jun 2026) repeals 598/2022. Wages due by 1st of following month (old 15-day grace gone). Compliance = pay >=85% of wages due by deadline. Escalation: day 2 alerts, day 5 permit suspension, day 11 fines/category downgrade, day 16 auto labour dispute, day 21 legal. Employer retains liability if delegated | EY ey.com/en_gl/technical/tax-alerts/uae-introduces-enhanced-wage-protection-system-effective-1-june-2026 | SECONDARY (EY, 3 mirrors; MOHRE PDF unreachable). "340" vs "0340" cosmetic. |
| UAE nationals pension (GPSSA) | Two regimes by registration date (~Oct 2023, FDL 57/2023): legacy EE 5% / ER 12.5% (15% public) / Govt 2.5%, cap ~AED 50,000; new: EE 11%, ER 15%, cap ~AED 70,000, floor ~AED 3,000. GCC nationals: home-country rules | sovereigngroup, zoho, uppersetup, csp | CONFLICTING on caps/cutoff; gpssa.gov.ae unreachable |
| DEWS | not verified here | - | UNVERIFIED |
| SIF layout | see WPS section | | SECONDARY (vendors) |

## SAUDI ARABIA
| Rule | Value | Cite | Conf |
|---|---|---|---|
| EOS (Art 84) | 1/2 month wage per yr first 5; 1 month per yr after; pro-rata partial years; wage includes fixed allowances; none in probation termination | haqq.ai, novatec, sighaty, zenhr | SECONDARY (laws.boe.gov.sa unreachable) |
| Resignation (Art 85) | <2y: 0; 2-<5y: 1/3; 5-<10y: 2/3; >=10y full; full for force majeure / woman within 6 mo of marriage or 3 mo of birth | same | SECONDARY; **2025 amendment (eff Feb 2025) disputed** on whether tiers still apply to open-ended contracts |
| GOSI Saudi, pre-3 Jul 2024 registrants | EE 9.75% + ER 11.75% = 21.5% (annuities 9/9 + SANED 0.75/0.75 + OHRH ER 2%) | Mercans mercans.com/resources/statutory-alerts/saudi-arabia-gosi-contribution-rates-saned-unemployment-fund-2026/ | SECONDARY; split of totals CONFLICTING across vendors (12/10, 12.5/10.5) |
| GOSI Saudi, post-3 Jul 2024 (new Social Insurance Law) | +0.5 pt/yr each July: Jul25-Jun26 EE 10.25 / ER 12.25 (22.5%); Jul26-Jun27 EE 10.75 / ER 12.75 (23.5%) | Mercans, ops.ae, saudicomplianceinstitute | SECONDARY (agree). Today (Oct 2026) the 23.5% tier applies. |
| GOSI expat | ER 2% only (OHRH), EE 0; no pension/SANED | Mercans + 5 others | SECONDARY, consistent |
| Base / ceiling | basic + housing; ceiling SAR 45,000/mo; floor not stated (min SAR 1,500 historically, unverified) | Mercans | SECONDARY |
| WPS/Mudad | Mudad file upload; deadline sources conflict (10th of month / within 10 days / upload window 30 days from 1 Mar 2025); universal coverage from 1 Jan 2026 (single source) | greythr, snad.io, innbuilt | CONFLICTING; no official spec read |
| Nitaqat / Qiwa | Mudad cross-checks Qiwa contract vs GOSI wage vs transfer; late pay hurts Nitaqat | greythr | SECONDARY |

## OMAN
| Rule | Value | Cite | Conf |
|---|---|---|---|
| PASI Omani | PwC (reviewed Jul 2026): pension EE 7.5 / ER 11 (to ceiling OMR 3,000); injury ER 1; job security EE 0.5 / ER 0.5 (no ceiling); maternity ER 1; sick leave ER 1 => EE 8% / ER 14.5% | PwC taxsummaries.pwc.com/oman/individual/other-taxes (Social Protection Law RD 52/2023) | CONFLICTING: vendor guides say EE 7% / ER 10.5-11.5%+1%+1%. PwC most recent -> use, flag |
| Expat | ER 3% (injury 1, maternity 1, sick 1) | PwC | SECONDARY |
| EOS expat (Labour Law RD 53/2023, Art 61) | >= 1 month basic per year; service before 31 Jul 2023 uses old 15d x 3y then 30d; pro-rata partial, no 1-yr minimum (one source) | Muscat Daily 2024-10-23 (MoL clarification), Curtis, PwC ME | SECONDARY; 26 vs 31 Jul date conflict |

## BAHRAIN
| Rule | Value | Cite | Conf |
|---|---|---|---|
| SIO Bahraini | EE 8% (7 pension + 1 unemployment); ER 17% in 2025 -> 18% 2026, +1pt/yr (end-point 20 vs 21% disputed); Law 14/2022 amending Decree-Law 24/1976 | PwC bahrain page (18/8 current), newsofbahrain, mercans | SECONDARY; 15% and "12%" figures circulate = CONFLICTING |
| Ceiling | BD 4,000/mo (single vendor) | bahrainagent.bh | UNVERIFIED |
| Expat | ER 3% / EE 1% (work injury) | PwC | SECONDARY |
| Expat EOS via SIO (PM Decision 109/2023, from 1 Mar 2024) | monthly ER contribution 4.2% of wage first 3 yrs, 8.4% after (single source) | mercans/silberson | UNVERIFIED |
| Labour Law 36/2012 EOS | 15 d/yr first 3 yrs, 1 month after (memory, not found) | - | UNVERIFIED |

## QATAR
| Rule | Value | Cite | Conf |
|---|---|---|---|
| GRSIA (Social Insurance Law 1/2022, eff 3 Jan 2023) | Qatari EE 7% / ER 14% of basic (+ allowances), ceiling QAR 100,000; housing capped QAR 6,000 (Mercans) | lexology, clydeco, paulhastings, mercans | SECONDARY (majority); minority 5/10 = CONFLICTING |
| EOS Labour Law 14/2004 Art 54 | 3 weeks basic/yr, >=1 yr service; not waivable | rivermate/others | SECONDARY, not read in text |
| WPS | Salaries via WPS in QAR; SIF file (below) | CBQ spec | PRIMARY for format |

## WPS / SIF layouts
**Qatar (PRIMARY: bank-published QCB/MoL spec, cbq.com.qa/-/media/project/cbq/cbqwebsite/documents/wps-file-format.pdf, QCB circular 2020/7 added version):** CSV RFC4180. Filename `SIF_<EmployerEID 7-8d>_<BankShort<=4>_<YYYYMMDD>_<HHMM>.csv`. Row1 header names; row2 header values; row3 record field names; record rows from row 4.
- Header (11): Employer EID N(8); creation date YYYYMMDD; time HHMM; Payer EID N(8) XOR Payer QID N(11); Payer bank short CHAR(4); Payer IBAN T(29); Salary YYYYMM; Total salaries D(18,2); Number of records N(6); SIF version T(35, optional, blank=0; "01" in newer).
- Record (22): Record sequence N(6); Employee QID N(11) XOR Visa ID T(12); Name T(70); Bank short T(4); Account/IBAN T(29); Frequency B|M; Working days N(3); Net salary D(18,2); Basic salary D(18,2); Extra hours D(3,2); Extra income D(18,2); Deductions D(18,2); Payment type T(50, opt); Notes T(300); Housing, Food, Transport, Overtime allowance D(18,2, optional, unvalidated); Deduction reason code N(2, mandatory if deduction>0, 99 needs notes); Extra fields 1-2.
Note: "Net = basic for days + extra income - deductions" is enforced.

**UAE (SECONDARY: Zoho Payroll guide, vendors disagree on IBAN length 23 vs 16 and salary-month format MMYYYY vs YYYY-MM; MOHRE/CBUAE spec not obtained; unknown whether 0340/2026 changed it):** `.SIF`, name = 13-digit MOHRE ID + YYMMDD + hhmmss. Line1 `SCR`: employer MOHRE ID(13), employer bank routing(9), date YYYY-MM-DD, time HHMM, salary month MMYYYY, record count, total AED, `AED`. Then `EDR` per employee: labour-card ID(14), agent routing(9), IBAN(23, AE...), period start, period end, days, fixed salary, variable income, leave-days/reference. Verify before building.

**Saudi Mudad, Kuwait KWPS, Oman, Bahrain:** no public field layout found (Mudad = XML per one vendor, CSV/Excel per another). UNVERIFIED.

## EMS READ-ONLY GAP ANALYSIS
Files read: prisma `StatutoryPack` (id, tenantId, country, version, effectiveFrom/To, packData Json; unique tenant+country+version); `src/utils/statutoryCalculation.js`; `src/utils/statutoryPackShape.js` (passes through `gratuity`); `scripts/globalCountryLitmusConfig.mjs` (SA, AE, VN, SG, CA...). No Kuwait/KWD seed in repo (memory says KWD tenant exists in Render DB; script not in repo).

**Already expressible as pack data**
- Effective-dated packs (effectiveFrom/To + `resolveStatutoryPackForEmployee`): July-each-year GOSI step-ups, Bahrain annual steps = one pack version per step.
- Flat EE/ER % on a tagged wage base with a ceiling (`contributionSchemes[]`: wageBaseTag, wageCeiling in minor units with ISO exponent, employee.rate/component, employer.rate/component): one scheme per fund works for Kuwait per-fund PIFSS (4-5 schemes, each own ceiling), Oman pension (with ceiling) + job-security/maternity/sick (no ceiling), Bahrain, Qatar GRSIA, Saudi single nationality class.
- 3-decimal currencies (KWD/OMR/BHD) correct via `minorUnitFactor`, rounding mode/precision (`resolveRounding` clamps to currency dp).
- Semi-monthly apportionment of capped contributions.
- ER-only schemes (employee.rate 0): Saudi/Oman expat injury 2-3%.

**Needs engine features (not present)**
1. Nationality-conditional schemes. `computeStatutoryContributions` has no per-employee predicate: it loops every scheme for every employee. Kuwait (nationals only), Saudi (Saudi vs expat vs pre/post-Jul-2024 registrants), Oman, Bahrain, Qatar, UAE GPSSA (UAE vs GCC vs expat; old/new regime) all need an `appliesTo` filter (nationality, GCC-ness, registration-date cohort). Today workaround = one pack per country per class, impossible inside one legal entity. Litmus SA hardcodes the expat 9.75/11.75 (which is actually wrong: expat is 0/2%).
2. Cohort effective-dating by employee attribute (first GOSI registration before/after 3 Jul 2024) — pack effective dates are by period, not employee.
3. Per-nationality ceilings/floors and minimum wage base (UAE floor, Kuwait/Saudi floors): only `wageCeiling`, no `wageFloor`/min contribution.
4. Multiple wage bases per scheme (Oman: pension base capped vs job-security uncapped) — works only as separate schemes; OK. Kuwait overlapping ceilings OK as separate schemes.
5. Gratuity/EOS: `gratuity` is stored as an opaque passthrough (`{daysPerYear, monthDivisor, minYears}`); there is NO calculator (payroll.service.js hardcodes `gratuity: 0`). Missing: tiered accrual (Kuwait 15d x5 then 30d; UAE 21d/30d; KSA 1/2 then 1 month; Oman), caps (Kuwait 1.5 yr, UAE 24 months), resignation-vs-termination tiers by years of service and contract type (Kuwait Art 53, KSA Art 85), daily vs monthly worker classes, wage base (basic only vs all fixed), pro-rata partial years, probation exclusion, effective-date split of service (Oman 31 Jul 2023), funded-scheme alternative (Bahrain SIO monthly 4.2%/8.4%).
6. Resignation tiers need termination-reason input (exit workflow / Resignation model exists but is unused by payroll).
7. SIF/WPS file generation: no generator; need per-country exporters (Qatar fully specifiable from the primary spec; UAE needs spec verification; others unknown) + routing/bank codes, labour-card/QID fields, IBAN validation, fixed/variable split, header checksums (count/total).
8. Overtime/leave premiums (Kuwait 25%/50%/100%, UAE 25/50) as pack rules: no overtime-premium schema seen in the statutory pack; sick-leave pay tiers (Kuwait 100/75/50/25, UAE 100/50/0) need leave-pay tiering.
9. Employer-only contributions are emitted as employer contributions, not part of net: correct. PIFSS employee 2.5% financial-remuneration "for 18 years" needs a service-years predicate.

## Biggest unresolved items (need official fetch or human with portal access)
PIFSS per-fund table & any 2025-26 change; Kuwaitization quotas; UAE GPSSA caps/cutoff and DEWS; UAE SIF official spec under Res 0340/2026; Saudi Art 84/85 text and Feb-2025 amendment effect, Mudad spec; Oman PASI (22.5% vs 18.5-20.5% vs official); Bahrain 2027-28 steps and BD 4,000 ceiling; Qatar Art 54 text and GRSIA circulars; Kuwait annual leave 6 vs 9 months; Kuwait notice-period months.
