# Accounting & Reimbursement — audit + roadmap

> Read-only audit of the live EMS backend (Hostinger `main`). Companion diagram:
> `ACCOUNTING_REIMBURSEMENT_FLOW.drawio` (open in draw.io / diagrams.net — 2 pages:
> **Flow (Current vs Gaps)** and **Roadmap (phases)**).

## Is it already there? — Yes, partially. Not greenfield.

| Capability | Status | %-done | Evidence |
|---|---|---:|---|
| **Reimbursement categories** (with monthly cap) | ✅ EXISTS | 90% | `ReimbursementCategory` model; `GET /payroll/reimbursement-categories` |
| **Reimbursement claim submit** | ✅ EXISTS | 75% | `POST /payroll/reimbursement-claims`; `submitReimbursementClaim` (enforces `CLAIM_OVER_CAP` 422) |
| **Claim approve / reject** | ✅ EXISTS | 70% | `PATCH /payroll/reimbursement-claims/:id`; status `SUBMITTED→APPROVED/REJECTED/PAID` |
| **Claim data model** | ✅ EXISTS | 95% | `ReimbursementClaim` (amount `Decimal(18,4)`, currency, `proofUrl`, `runId`, lifecycle) |
| **Receipt/proof upload** | ⚠️ PARTIAL | 20% | `proofUrl` is a bare string — no authenticated upload endpoint (unlike `/employees/:id/documents`) |
| **Cap enforcement** | ⚠️ PARTIAL | 40% | Enforced **per single claim**, not per-**month aggregate** — N sub-cap claims bypass it |
| **Approver relationship guard** | ❌ MISSING | 0% | `decideReimbursementClaim` has no manager↔employee check (reuse `assertCanApprove` from BE-SEC-2) |
| **Reimbursement → payout/settlement** | ❌ MISSING | 10% | `runId` field exists but nothing pulls APPROVED claims into a `PaymentBatch`/`PayrollRun`; `PAID` is a manual status flip |
| **Payroll accounting journal** | ✅ EXISTS | 60% | `getRunJournal` + `exportRunJournal` (CSV) by `glAccountCode` + `costCenterRule` (DEPARTMENT/NONE) on `SalaryComponent` |
| **General Ledger (persistent, double-entry)** | ❌ MISSING | 0% | No `ChartOfAccount` / `LedgerEntry` / `AccountingPeriod` models; journal is per-run export only |
| **Non-payroll journals** (reimbursement / invoice / advance) | ❌ MISSING | 0% | Only payroll runs post to the journal |
| **Trial balance / period close / lock** | ❌ MISSING | 0% | — |
| **External accounting export** (Tally/QuickBooks/Xero/Zoho) | ❌ MISSING | 0% | — |
| **Supporting infra** (payout, invoice, loan, garnishment) | ✅ EXISTS | 80% | `PaymentBatch`, `PayoutMethod` (AES-256-GCM), `PayoutApproval`, `ContractorInvoice`, `EmployeeLoan`, `Garnishment` |

**Bottom line:** Reimbursement ≈ **60–65%** (claim capture + approval done; payout, receipt upload, aggregate caps, authz missing). Accounting ≈ **35–40%** (payroll-run GL export + cost-center allocation done; no persistent ledger, no non-payroll postings, no close, no external export).

## Roadmap (each phase ships + deploys independently)

- **P0 — Reimbursement hardening** *(small; mostly reuse existing patterns)*
  ownership guard on submit · `assertCanApprove` on decide · per-**month** aggregate cap · authenticated receipt upload (WebP/PDF, mirrors BE-SEC-1 doc flow) · employee self-service "my claims" list.
- **P1 — Reimbursement → payout** *(medium)*
  pull APPROVED claims into a `PaymentBatch`/`PayrollRun` payable · disburse via the existing bank-file + `PayoutMethod` · `PAID` tied to a real payment reference · notifications.
- **P2 — General Ledger core** *(large)*
  `ChartOfAccount` + CRUD · `LedgerEntry` (double-entry, source ref) · post from payroll run (extend `getRunJournal`), reimbursement `PAID`, and `ContractorInvoice` · `AccountingPeriod` open/closed + lock.
- **P3 — Reporting & close** *(medium)*
  trial balance · GL by account/cost-center · period-close workflow + immutability · accrual-vs-cash toggle · `AuditLog` on every posting.
- **P4 — External integrations** *(medium)*
  Tally / QuickBooks / Xero / Zoho export · per-provider mapping · SSRF-guarded close webhook (BE-SEC-6) · multi-currency consolidation (**depends on BE-PAY-4 FX**).

**Cross-cutting (every phase):** `API_MAPPING.md` + Swagger per endpoint · `node:test` oracle per money rule · `Decimal(18,4)` + currency-aware `roundMoney` · tenant + role isolation · live-verify on Hostinger.

## Dependencies / relationships
- P4 multi-currency consolidation needs **BE-PAY-4** (FX rates + as-of date) fixed first.
- P0 approver guard reuses **BE-SEC-2** `assertCanApprove`; receipt upload reuses **BE-SEC-1** authenticated Cloudinary + signed download.
- GL postings should honor **BE-PAY-3** rounding config once implemented.
