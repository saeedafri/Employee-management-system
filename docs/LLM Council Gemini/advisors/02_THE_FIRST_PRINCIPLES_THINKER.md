# Advisor 2: The First Principles Thinker

> **Council Lens**: Fundamental truths, root problems, and essential invariants  
> **Topic**: What is an HRMS at its physical core?

---

## Analysis

Strip away the marketing labels, the 78 tables, and the UI fluff. What is an HRMS at its physical core?

An HRMS is an immutable, double-entry state machine that tracks two physical primitives:
1. **Time Worked** (Units of human labor provided to an organization).
2. **Compensation Owed** (Units of currency owed in exchange for that labor, adjusted for state-mandated deductions).

Every feature in an HR system exists solely to support or audit these two primitives:
- Attendance & Leave are simply **Time inputs**.
- Salary structures & Payslips are simply **Compensation formulas**.
- Roles & Multi-tenancy are simply **Access boundaries** on who can view or alter the records.

### Where EMS Violates First Principles:

When your system allows an employee's check-in time to be recorded, but calculates their team's monthly attendance by executing 150 serial queries in a loop, you have violated the computational principle of algorithmic efficiency.

When your payroll reporting endpoint returns a fabricated ₹80,000 calculation because the developer didn't connect the report to the `Payslip` table, you have violated the cardinal principle of financial software: **Conservation of Truth**. A system of record that reports numbers not derived from its own transactional ledger is not a software system—it is a mock.

When `leaveEngine.repository.js` omits `employeeId` for Super Admins and sums every employee's leave balance in the company into one account, you have violated entity identity. A company balance is not a personal balance.

### First Principles Verdict:
You do not need to rewrite the codebase, nor do you need to add AI agents or biometric hardware yet. You must establish mathematical integrity:
1. Ensure the transactional ledger (`AttendanceRecord`, `LeaveBalance`, `Payslip`) is the **single source of truth** for all read models.
2. Ensure the state transitions (Check-in -> Regularization -> Approval -> Leave Deduction -> Payroll Calculation) are mathematically deterministic and auditable.
3. Eliminate all synthetic, simulated, or hardcoded calculations immediately.
