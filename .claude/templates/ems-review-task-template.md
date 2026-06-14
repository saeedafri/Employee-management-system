# EMS Review Task Template

Use this when user says "check now", "verify", "review", or pastes agent summary.

Required process:
1. Do not trust summary blindly.
2. Inspect changed files.
3. Use Graphify/code-review-graph for impacted paths.
4. Use relevant subagent.
5. Compare code against original acceptance criteria.
6. Check API_MAPPING/Swagger if API changed.
7. Identify blockers vs non-blockers.
8. Do not mark PASS without proof.

Output:
- Verdict
- Confirmed fixes
- Remaining blockers
- Required next prompt if not PASS
- UI-safe message only if PASS
