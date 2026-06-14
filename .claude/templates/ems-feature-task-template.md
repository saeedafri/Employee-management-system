# EMS Feature Task Template

## Task

<describe task>

## Required Claude Workflow

Before editing:
- Invoke backend-contract-auditor.
- Use Graphify/code-review-graph to map affected files.
- Invoke relevant domain subagent.
- Produce a requirement-to-file map.
- Produce a checklist.
- Ask before DB/deployed/test commands.

During implementation:
- Update source, API schemas, Swagger/OpenAPI, and API_MAPPING together when needed.
- No hardcoded tenant/country logic unless explicitly required.
- Preserve existing behavior.

Safety:
- Do not run DB/migration/seed/deployed API/test commands unless explicitly approved.
- If command could mutate data, stop and ask.

Final report:
- Root cause
- Files changed
- Implementation summary
- Docs/API_MAPPING/Swagger updates
- Commands run
- Evidence
- Remaining gaps
- Final verdict
