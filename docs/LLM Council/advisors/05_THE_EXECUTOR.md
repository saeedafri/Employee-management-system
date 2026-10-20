# Advisor 5: The Executor

> **Council Lens**: Tactical delivery, Monday morning execution, minimal viable sequence  
> **Topic**: What Code Gets Shipped, In What Order, and By When?

---

## Analysis

I have zero patience for philosophy, macroeconomic theories, or futuristic AI copilot fantasies. We have real code running on a Hostinger VPS (`187.126.125.239`), real Git repositories, and real bugs in front of us.

The proposed Master Build Plan has the right sequencing, but it needs an unforgiving, tactical execution schedule. If we try to do everything at once, we will ship nothing.

Here is the exact battle plan for the next 72 hours:

### 1. Monday Morning (Hour 0–4): The 3 One-Line Fixes
Three critical bugs can be eliminated in under 4 hours without touching database schemas or changing UI layouts:
- **Wrap Fastify Plugins with `fp()`**: Edit `cors.js`, `helmet.js`, and `rateLimit.js`. Wrap in `fastify-plugin`. Instantly restores security headers and rate limits across all 420 endpoints.
- **Add Next.js Edge `src/middleware.ts`**: 25 lines of TypeScript. Immediately stops the unauthenticated bundle leak and redirects to `/login` at the HTTP edge.
- **Fix Super Admin Leave Ledger**: In `leaveEngine.repository.js:76`, add `if (!employeeId) return [];`. Eliminates the multi-tenant balance sum collapse.

### 2. Monday Afternoon (Hour 4–8): Fix Contract Drift & Attendance N+1
- **Leave Preview**: Add `fastify.get('/requests/preview', ...)` alias in `leave.routes.js` alongside existing `POST`. Adjust AJV reason validator `minLength` from 10 down to 5 to match frontend Zod.
- **Attendance Batch Query**: Replace the `for (const emp of teamMembers)` loop in `attendance.service.js:419` with a single `prisma.attendanceRecord.findMany({ where: { employeeId: { in: ids } } })`. Team page latency drops from 3,740ms to 120ms.

### 3. Tuesday & Wednesday (Days 2–3): Eliminate Fakes in Payroll & F&F
- In `reports.repository.js`, delete the hardcoded `const grossPay = 80000;` block. Replace it with `prisma.payslip.aggregate()`.
- In `payroll.service.js:1052`, write the real formula for leave encashment `(basic/30 * remainingDays)` and gratuity `(15 * basic * tenure)/26`.

### Executor Verdict:
Do not debate whether we are Keka, Deel, or SAP. Execute Tasks 0.1 through 0.5 immediately. When the system stops leaking, stops freezing, and stops lying in its reports, then and only then do we start Phase 1.
