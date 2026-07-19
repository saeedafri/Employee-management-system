# Live E2E evidence — Hostinger deploy `68d32f4`

> **Date:** 2026-07-19  
> **Environment:** Hostinger VPS `srv1067327` / `31.97.186.223`  
> **Containers:** `ems-backend`, `ems-postgres`, `ems-redis` (Docker)  
> **API:** `https://ems-api.saqibsaeed.cloud`  
> **Method:** Hostinger Browser Terminal (agent Mac cannot route to VPS — ISP block)

---

## 1. Pre-deploy (Set 1 + Set 2)

| Check | Result |
|-------|--------|
| Docker EMS containers | Up; backend `127.0.0.1:4001`, PG/Redis loopback only |
| Local health | `{"status":"ok"}` |
| Public health | HTTP 200 |
| Git before deploy | `8a8a966` |
| UFW / fail2ban | none |
| iptables INPUT | ACCEPT (empty) |
| SSH | listening `22` + `2222`, pubkey enabled |
| Conclusion | VPS healthy; Mac→VPS unreachable is **not** a Hostinger firewall issue |

---

## 2. Deploy (Set 3)

| Step | Result |
|------|--------|
| Backup | `/opt/ems/backups/ems_predeploy_20260719_164035.sql.gz` |
| `git pull` | `68d32f4 feat(hostinger): server exports, permissions, ops logs, SA empty reads` |
| `docker compose build/up ems-backend` | Started |
| `prisma migrate deploy` | 28 migrations; none pending |
| Local health after restart | 200 (after brief 000 while container came up) |
| Public health | 200 |

---

## 3. Super Admin smoke (on-box curl)

```
POST /api/v1/auth/login  superadmin@acme.test  → token_len=645
GET  /api/v1/attendance/summary                → summary_http=200
noEmployeeRecord= True
```

Body:

```json
{
  "success": true,
  "data": {
    "totalDays": 0,
    "present": 0,
    "absent": 0,
    "leave": 0,
    "wfh": 0,
    "halfDay": 0,
    "holiday": 0,
    "late": 0,
    "noEmployeeRecord": true
  },
  "meta": {}
}
```

**Interpretation:** Pre-fix SA path returned **400 `NO_EMPLOYEE_RECORD`** and FE showed “Something went wrong.” Post-fix personal **read** returns **200 empty** with flag. Writes still correctly reject without employee.

---

## 4. Agent-host retest attempt (blocked)

From author Mac (`103.211.52.16`) after deploy:

```
curl https://ems-api.saqibsaeed.cloud/health → http=000 (timeout ~15s)
```

SSH `:22`/`:2222` and HTTPS remain unreachable from that network. Therefore full multi-role curl matrix + Playwright from the agent host was **not** possible after deploy. Hostinger Terminal remains the authoritative live proof for this commit.

---

## 5. Offline policy smoke (local, no DB)

```
SUPER_ADMIN 14 keys (incl permissions:manage)
HR_ADMIN 13 (incl leave:request, employees:export)
MANAGER 8
EMPLOYEE 6 (no analytics/audit)
AUDITOR 6 (read + analytics + audit; no attendance:write)
HR export true / EMP export false / SA bypass true
```

---

## 6. Remaining E2E for UI team

| Case | Status |
|------|--------|
| SA attendance/payout empty UX in browser | BE ready; FE empty-state still required |
| HR export PDF/CSV via UI | BE ready; FE must call server export |
| SSE on Vercel | BE ready; FE must deploy EventSource BFF |
| Role-filtered nav | FE only |
| EMP denied `/ops/logs` + export | Expected 403 — confirm in FE/Network |

---

## Verdict

| Scope | Result |
|-------|--------|
| Hostinger BE deploy `68d32f4` | **PASS** |
| SA empty-read regression on API | **PASS** (VPS curl) |
| Full browser multi-role E2E from agent | **BLOCKED** (network) |
| UI contract pack | **READY** — see `UI_TEAM_HANDOFF_HOSTINGER_HARDENING_2026-07-19.md` |
