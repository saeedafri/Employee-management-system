#!/usr/bin/env python3
"""Build EMS Backend Technical Documentation v3.

Fixes blank PDF pages, colors all Mermaid diagrams, adds callout boxes,
pre-renders diagrams to PNG, and generates publication PDF via gstack make-pdf.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DOC = ROOT / "docs" / "EMS_BACKEND_TECHNICAL_DOCUMENTATION.md"
PDF = ROOT / "docs" / "EMS_BACKEND_TECHNICAL_DOCUMENTATION.pdf"
ASSETS = ROOT / "docs" / ".pdf-assets"
MAKE_PDF = Path.home() / ".claude" / "skills" / "gstack" / "make-pdf" / "dist" / "pdf"
MERMAID_CONFIG = ROOT / "scripts" / "mermaid-pdf-theme.json"

MERMAID_INIT_FLOW = (
    "%%{init: {'theme': 'base', 'themeVariables': { "
    "'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2'"
    "}}}%%"
)
MERMAID_INIT_SEQUENCE = (
    "%%{init: {'theme': 'base', 'themeVariables': { "
    "'primaryColor': '#e3f2fd', 'primaryTextColor': '#1565c0', 'lineColor': '#1976d2', "
    "'actorBkg': '#e8f5e9', 'actorTextColor': '#1b5e20', 'actorLineColor': '#2e7d32', "
    "'actorBorder': '#2e7d32', 'signalColor': '#1976d2', 'signalTextColor': '#0d47a1', "
    "'noteBkgColor': '#fff3e0', 'noteTextColor': '#e65100'"
    "}}}%%"
)
MERMAID_INIT_STATE = (
    "%%{init: {'theme': 'base', 'themeVariables': { "
    "'primaryColor': '#e8f5e9', 'primaryTextColor': '#1b5e20', 'lineColor': '#1976d2'"
    "}}}%%"
)
MERMAID_INIT_ER = (
    "%%{init: {'theme': 'base', 'themeVariables': { "
    "'primaryColor': '#fff3e0', 'primaryTextColor': '#e65100', 'lineColor': '#1976d2'"
    "}}}%%"
)

MERMAID_CLASSDEFS = """\
    classDef client fill:#e3f2fd,stroke:#1565c0,color:#0d47a1
    classDef api fill:#e8f5e9,stroke:#2e7d32,color:#1b5e20
    classDef db fill:#fff3e0,stroke:#ef6c00,color:#e65100
    classDef external fill:#f3e5f5,stroke:#7b1fa2,color:#4a148c
    classDef warn fill:#ffebee,stroke:#c62828,color:#b71c1c"""

OLD_CLASSDEF_RE = re.compile(
    r"\n\s*classDef client fill:#[0-9A-Fa-f]+,stroke:#[0-9A-Fa-f]+,color:#[0-9A-Fa-f]+\s*"
    r"\n\s*classDef api fill:#[0-9A-Fa-f]+,stroke:#[0-9A-Fa-f]+,color:#[0-9A-Fa-f]+\s*"
    r"\n\s*classDef db fill:#[0-9A-Fa-f]+,stroke:#[0-9A-Fa-f]+,color:#[0-9A-Fa-f]+\s*"
    r"(?:\n\s*classDef external fill:#[0-9A-Fa-f]+,stroke:#[0-9A-Fa-f]+,color:#[0-9A-Fa-f]+\s*)?",
    re.MULTILINE,
)

NODE_ID_RE = re.compile(
    r"(?:^|\s|-->|---)\s*(\w+)\s*(?:\[|\(\[|{{|\{|\()",
    re.MULTILINE,
)
CLASS_LINE_RE = re.compile(r"^\s*class\s+(.+?)\s+(\w+)\s*$", re.MULTILINE)

SECTION_CALLOUTS: dict[str, tuple[str, str]] = {
    "1. Executive Summary": (
        "EMS is a multi-tenant HR API — one codebase serves many companies, each isolated by tenant.",
        "This section orients architects and new backend engineers on scope, endpoints, and design goals.",
    ),
    "2. System Architecture Overview": (
        "Every request flows through nginx → Fastify middleware → domain modules → Prisma → PostgreSQL.",
        "Understand the layers before diving into individual modules or auth rules.",
    ),
    "3. Technology Stack": (
        "Node 20, Fastify 4, Prisma 5, and PostgreSQL form the core; integrations handle email, files, and exports.",
        "Versions and libraries listed here are the supported production stack.",
    ),
    "4. Project Structure": (
        "Code is organized by domain module, each following routes → controller → service → repository.",
        "Use this map to find where to add endpoints or trace a bug through the stack.",
    ),
    "5. Multi-Tenancy Deep Dive": (
        "Every database row belongs to exactly one tenant — isolation is enforced at query time.",
        "Tenant resolution runs before protected handlers; never query without `tenantId`.",
    ),
    "6. Authentication & Authorization": (
        "Short-lived JWT access tokens plus rotating httpOnly refresh cookies secure sessions.",
        "Roles (`memberType`) gate endpoints; SUPER_ADMIN bypasses all role checks.",
    ),
    "7. Module Reference": (
        "Each domain (employees, leave, payroll, etc.) is a self-contained Fastify route group.",
        "Pick the module that matches your feature; follow the layered pattern inside it.",
    ),
    "8. Database Schema Overview": (
        "Prisma models mirror PostgreSQL tables — 40+ entities scoped by `tenantId`.",
        "Schema relationships drive how services join data; no raw SQL in this codebase.",
    ),
    "9. Payroll Engine": (
        "Payroll computes gross → statutory deductions → tax → net per employee per run.",
        "Highest-risk domain — calculations are data-driven via StatutoryPack JSON, not hardcoded country logic.",
    ),
    "10. External Integrations": (
        "Email (Resend), file storage (Cloudinary), and optional Redis (BullMQ) live outside the monolith.",
        "Each integration degrades gracefully when env vars are missing.",
    ),
    "11. Error Handling & Logging": (
        "All errors return a consistent JSON envelope via `errorResponse()`.",
        "Pino logs every request; audit logs capture business mutations immutably.",
    ),
    "12. Testing Strategy": (
        "Unit, integration, and E2E tests guard regressions — integration tests use a local test DB only.",
        "Never run `npm test` against production DATABASE_URL.",
    ),
    "13. Deployment": (
        "Primary production runs on Hostinger VPS (Docker + nginx); Render is a legacy target.",
        "Deploys are automated via GitHub Actions with pre-deploy database backups.",
    ),
    "14. Security Considerations": (
        "Defense in depth: Argon2id passwords, JWT rotation, rate limits, helmet headers, tenant isolation.",
        "Review this before exposing new endpoints or changing auth flows.",
    ),
    "15. Known Issues (E2E Audits)": (
        "Documented gaps found by automated UI/API audits — not blockers but tracked honestly.",
        "Check here before assuming a wireframe feature is fully implemented.",
    ),
    "16. API Reference Overview": (
        "Canonical contract lives in Swagger (`/docs`) and `docs/API_MAPPING.md`.",
        "This section summarizes route groups; use API_MAPPING for field-level shapes.",
    ),
    "17. End-to-End Workflow Diagrams": (
        "Visual walkthroughs of major business flows with numbered steps.",
        "Blue = client, green = API, orange = database, purple = external services.",
    ),
    "18. Utilities Reference": (
        "Shared helpers in `src/utils/` — hashing, money, statutory math, trees, exports.",
        "Reuse these instead of duplicating logic inside services.",
    ),
    "19. Middleware & Plugins Reference": (
        "Fastify hooks and plugins run in a fixed order before your route handler.",
        "Changing plugin order can break auth, tenant resolution, or Swagger registration.",
    ),
}

QUICK_START = r"""
## 0. Quick Start for New Developers

<blockquote style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:12px 16px;margin:16px 0;">
<strong>In simple terms:</strong> Clone the repo, start local Postgres, migrate, seed, and hit Swagger — you will have a working API in about 15 minutes.
</blockquote>

> **What it does:** Gets a new engineer from zero to a working local API in under 15 minutes.
>
> **Why it matters:** Onboarding speed reduces mistakes against production data.
>
> **How it works:** Clone → local Postgres → migrate → seed → dev server → Swagger login.

### 0.1 Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | ≥ 20 | Runtime (ES modules) |
| Docker | any recent | Local PostgreSQL only |
| Git | 2.x | Clone + branch workflow |

### 0.2 First-Time Setup

1. Clone the repository and install dependencies.
2. Start PostgreSQL via Docker Compose.
3. Point `DATABASE_URL` at the local database.
4. Run Prisma migrations and seed data.
5. Start the dev server and open Swagger.

```bash
git clone https://github.com/saeedafri/Employee-management-system.git EMS
cd EMS
npm ci
docker compose up -d
export DATABASE_URL=postgresql://ems:ems_local_dev@127.0.0.1:5432/ems_dev
npx prisma migrate deploy
npm run db:seed
npm run dev
```

### 0.3 Verify Login (Swagger or curl)

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Key: acme-corp-001" \
  -d '{"email":"hr@acme.test","password":"Password123!"}' | jq .
```

Open **http://localhost:3000/docs** — authorize with the returned `accessToken`.

### 0.4 Where to Look First

| Task | Start here |
|------|-----------|
| Add an API endpoint | `src/modules/<domain>/*.routes.js` → controller → service → repository |
| Change auth rules | `src/middleware/authenticate.js` |
| Tenant scoping | `src/middleware/resolveTenant.js` + always `tenantId` in Prisma `where` |
| Payroll math | `src/modules/payroll/` + `src/utils/statutoryCalculation.js` |
| API contract | `docs/API_MAPPING.md` + `src/plugins/swagger.js` |
| Deploy | `.github/workflows/deploy-hostinger.yml` |

"""


def callout(simple: str, detail: str = "") -> str:
    extra = f"<br><em>{detail}</em>" if detail else ""
    return (
        f'\n<blockquote style="background:#e3f2fd;border-left:4px solid #1565c0;'
        f'padding:12px 16px;margin:16px 0;">\n'
        f"<strong>In simple terms:</strong> {simple}{extra}\n</blockquote>\n"
    )


def classify_node(node_id: str, diagram_text: str) -> str:
    """Heuristic node → class mapping for flowcharts."""
    n = node_id.upper()
    ctx = diagram_text.upper()

    warn_ids = {
        "E400", "E401", "E403", "E409", "E401B", "F403", "F409", "F1", "429",
        "REV", "ERR", "E400A",
    }
    if n in warn_ids or n.startswith("E4") or n.startswith("F4"):
        return "warn"
    if "401" in n or "403" in n or "409" in n or "429" in n:
        return "warn"
    if any(k in n for k in ("FAIL", "ERROR", "DENIED", "INVALID")):
        return "warn"

    db_ids = {
        "PG", "PRISMA", "DB", "D1", "D2", "D3", "HIST", "AUDIT", "BACKUP", "SR",
        "AC4", "AP2", "OUT",
    }
    if n in db_ids or n.startswith("D") and n[1:].isdigit():
        return "db"
    if "POSTGRES" in ctx and n in {"DB", "RP"}:
        return "db"

    external_ids = {
        "RESEND", "CLD", "REDIS", "RD", "J3", "J4", "AP3", "NOTE", "FUTURE", "S10",
        "E1", "GHA", "DEV", "DNS",
    }
    if n in external_ids:
        return "external"

    client_ids = {
        "FE", "SW", "MOB", "REQ", "IN", "START", "C", "C1", "USER", "PUSH", "DEL",
        "HR", "Q", "R1", "T1", "T2", "T3", "MUT", "P1", "S1", "C1",
    }
    if n in client_ids:
        return "client"
    if n == "PREFIX" or n == "USE":
        return "client"

    return "api"


def extract_flowchart_nodes(body: str) -> set[str]:
    nodes: set[str] = set()
    skip = {"subgraph", "end", "class", "classDef", "style", "linkStyle", "direction"}
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("%%"):
            continue
        if stripped.startswith("class ") or stripped.startswith("classDef"):
            continue
        for match in NODE_ID_RE.finditer(line):
            nid = match.group(1)
            if nid.lower() not in skip:
                nodes.add(nid)
        for part in re.findall(r"-->\s*(\w+)", line):
            if part.lower() not in skip:
                nodes.add(part)
    return nodes


def existing_class_assignments(body: str) -> dict[str, str]:
    assignments: dict[str, str] = {}
    for match in CLASS_LINE_RE.finditer(body):
        ids, cls = match.group(1), match.group(2)
        for node_id in re.split(r"[\s,]+", ids.strip()):
            if node_id:
                assignments[node_id] = cls
    return assignments


def strip_mermaid_styling(body: str) -> str:
    """Remove class/classDef lines (including corrupted merges from prior builds)."""
    clean: list[str] = []
    for line in body.splitlines():
        stripped = line.strip()
        if not stripped:
            clean.append("")
            continue
        if "classDef" in stripped:
            continue
        if stripped.startswith("class "):
            continue
        clean.append(line)
    text = "\n".join(clean)
    return re.sub(r"\n{3,}", "\n\n", text).strip()




def close_open_subgraphs(body: str) -> str:
    """Insert missing subgraph end markers before styling lines."""
    lines = body.splitlines()
    depth = 0
    for line in lines:
        s = line.strip()
        if s.startswith("subgraph"):
            depth += 1
        elif s == "end":
            depth = max(0, depth - 1)
    if depth <= 0:
        return body
    out = list(lines)
    for _ in range(depth):
        out.append("    end")
    return "\n".join(out)

def upgrade_mermaid_block(block: str) -> str:
    """Ensure init theme, standard classDefs, and class on every flowchart node."""
    lines = block.strip().splitlines()
    if not lines:
        return block

    first = lines[0].strip()
    diagram_type = first
    body_lines = lines[1:]
    if body_lines and body_lines[0].strip().startswith("%%{init:"):
        body_lines = body_lines[1:]

    body = strip_mermaid_styling("\n".join(body_lines))
    body = close_open_subgraphs(body)
    body = OLD_CLASSDEF_RE.sub("", body)

    if diagram_type.startswith("flowchart") or diagram_type.startswith("graph "):
        init = MERMAID_INIT_FLOW
        assignments = existing_class_assignments(body)
        nodes = extract_flowchart_nodes(body)
        buckets: dict[str, list[str]] = {
            "client": [], "api": [], "db": [], "external": [], "warn": [],
        }
        for node in sorted(nodes):
            cls = assignments.get(node) or classify_node(node, body)
            if cls not in buckets:
                cls = "api"
            buckets[cls].append(node)

        class_lines = []
        for cls, ids in buckets.items():
            if ids:
                class_lines.append(f"    class {','.join(ids)} {cls}")
        body = (
            body.rstrip()
            + "\n\n"
            + MERMAID_CLASSDEFS.strip()
            + "\n"
            + "\n".join(class_lines)
        )
    elif diagram_type.startswith("sequenceDiagram"):
        init = MERMAID_INIT_SEQUENCE
    elif diagram_type.startswith("stateDiagram"):
        init = MERMAID_INIT_STATE
    elif diagram_type.startswith("erDiagram"):
        init = MERMAID_INIT_ER
    else:
        init = MERMAID_INIT_FLOW

    return f"{diagram_type}\n{init}\n{body.strip()}\n"


def process_all_mermaid(text: str) -> tuple[str, int]:
    count = 0

    def replacer(match: re.Match[str]) -> str:
        nonlocal count
        count += 1
        upgraded = upgrade_mermaid_block(match.group(1))
        return f"```mermaid\n{upgraded}```"

    updated = re.sub(r"```mermaid\n(.*?)```", replacer, text, flags=re.DOTALL)
    return updated, count


def fix_page_breaks(text: str) -> tuple[str, int]:
    """Remove blank-page causes: broken newpage, duplicates, trailing breaks."""
    fixes = 0

    # Repair corruption where Python \\n in "\\newpage" became newline + "ewpage"
    if re.search(r"^ewpage\s*$", text, flags=re.MULTILINE):
        text = re.sub(r"^ewpage\s*$", "", text, flags=re.MULTILINE)
        fixes += 1

    marker = r"\newpage" + "\n\n---\n\n## 1."
    if marker in text and "## 0. Quick Start" not in text:
        text = text.replace(marker, r"\newpage" + QUICK_START + "\n---\n\n## 1.", 1)
        fixes += 1

    before = text
    text = re.sub(r"(\\newpage\s*\n){2,}", r"\\newpage\n", text)
    fixes += len(re.findall(r"(\\newpage\s*\n){2,}", before))

    text = re.sub(r"\\newpage\s*\n\s*---\s*\n\s*\*End of Document", "\n---\n\n*End of Document", text)
    text = re.sub(r"\\newpage\s*\n+\s*---\s*\n+\s*\*End of Document", "\n---\n\n*End of Document", text)
    text = re.sub(r"\\newpage\s*\n+\s*$", "", text)

    return text, fixes


def reorder_appendices(text: str) -> str:
    """Order: Appendix A, B, C, D (glossary and history before route index)."""
    pattern = (
        r"(## Appendix C — Complete API Route Index.*?)"
        r"(## Appendix D — Developer Troubleshooting.*?)"
        r"(## Appendix A — Glossary \(Expanded\).*?)"
        r"(## Appendix B — Document Revision History.*?)"
        r"(---\s*\n\s*\*End of Document[^*]*\*)"
    )
    match = re.search(pattern, text, flags=re.DOTALL)
    if not match:
        return text
    c, d, a, b, end = match.groups()
    replacement = a + "\n\n" + b + "\n\n" + c + "\n\n" + d + "\n\n" + end
    return text[: match.start()] + replacement + text[match.end() :]


def bump_version(text: str) -> str:
    text = text.replace('version: "July 2026 v2.0"', 'version: "July 2026 v3.0"')
    text = text.replace("**Version** | July 2026 **v2.0** |", "**Version** | July 2026 **v3.0** |")
    text = text.replace("*End of Document — v2.0*", "*End of Document — v3.0*")
    if "| July 2026 | **3.0** |" not in text:
        text = text.replace(
            "| July 2026 | **2.0** | Expanded workflows, Hostinger deep dive, colored diagrams, Quick Start, full utils/middleware reference, 18+ new flowcharts |",
            "| July 2026 | **2.0** | Expanded workflows, Hostinger deep dive, colored diagrams, Quick Start, full utils/middleware reference, 18+ new flowcharts |\n"
            "| July 2026 | **3.0** | PDF blank-page fixes, all diagrams pre-rendered in color, section callouts, appendix reorder, HTML tables |",
        )
    return text


def update_cover(text: str) -> str:
    cover = """<div class="title-page" style="background:linear-gradient(135deg,#1565c0 0%,#2e7d32 100%);color:#fff;padding:48px 32px;border-radius:8px;">

# EMS Backend — Technical Documentation

**Employee Management System REST API**

<p><strong>Version:</strong> July 2026 v3.0<br>
<strong>Runtime:</strong> Node.js 20+ (ES Modules)<br>
<strong>Primary API:</strong> https://ems-api.saqibsaeed.cloud/api/v1<br>
<strong>Swagger UI:</strong> https://ems-api.saqibsaeed.cloud/docs<br>
<strong>Repository:</strong> github.com/saeedafri/Employee-management-system</p>

</div>"""
    text = re.sub(
        r'<div class="title-page"[^>]*>.*?</div>',
        cover,
        text,
        count=1,
        flags=re.DOTALL,
    )
    return text


def add_section_callouts(text: str) -> str:
    for section_key, (simple, detail) in SECTION_CALLOUTS.items():
        heading = f"## {section_key}"
        if heading not in text:
            continue
        if f"In simple terms:</strong> {simple[:40]}" in text:
            continue
        marker = heading + "\n\n"
        if marker in text and callout(simple, detail).strip() not in text:
            text = text.replace(marker, heading + callout(simple, detail) + "\n", 1)
    return text


def add_section_dividers(text: str) -> str:
    def repl(match: re.Match[str]) -> str:
        level = match.group(1)
        title = match.group(2)
        if title.startswith("Table of Contents") or title.startswith("0. Quick Start"):
            return match.group(0)
        if level == "##":
            return f'\n<hr style="border:none;border-top:3px solid #1976d2;margin:28px 0 16px 0;">\n\n## {title}'
        return match.group(0)

    return re.sub(r"^(##+)\s+(.+)$", repl, text, flags=re.MULTILINE)


def pipe_table_to_html(table_text: str) -> str | None:
    lines = [ln.strip() for ln in table_text.strip().splitlines() if ln.strip()]
    if len(lines) < 2 or "|" not in lines[0]:
        return None
    if not re.match(r"^\|?[\s\-:|]+\|?$", lines[1].replace(" ", "")):
        return None

    def cells(row: str) -> list[str]:
        row = row.strip().strip("|")
        return [c.strip() for c in row.split("|")]

    headers = cells(lines[0])
    rows = [cells(ln) for ln in lines[2:]]
    html = [
        '<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:0.92em;">',
        "<thead><tr>"
        + "".join(
            f'<th style="background:#1565c0;color:#fff;padding:8px 10px;text-align:left;border:1px solid #0d47a1;">{h}</th>'
            for h in headers
        )
        + "</tr></thead><tbody>",
    ]
    for i, row in enumerate(rows):
        bg = "#f5f9ff" if i % 2 == 0 else "#ffffff"
        html.append(
            "<tr>"
            + "".join(
                f'<td style="background:{bg};padding:8px 10px;border:1px solid #e0e0e0;vertical-align:top;">{c}</td>'
                for c in row
            )
            + "</tr>"
        )
    html.append("</tbody></table>")
    return "\n".join(html)


def convert_tables_to_html(text: str) -> str:
    """Convert markdown pipe tables outside code fences to styled HTML tables."""
    parts = re.split(r"(```[\s\S]*?```|<div class=\"title-page\"[\s\S]*?</div>)", text)
    out: list[str] = []
    table_block_re = re.compile(r"(?:^|\n)((?:\|[^\n]+\|\n)+)", re.MULTILINE)

    for part in parts:
        if part.startswith("```") or part.startswith('<div class="title-page"'):
            out.append(part)
            continue

        def table_repl(m: re.Match[str]) -> str:
            block = m.group(1)
            html = pipe_table_to_html(block)
            return "\n" + html + "\n" if html else m.group(0)

        out.append(table_block_re.sub(table_repl, part))
    return "".join(out)


def ensure_mermaid_config() -> None:
    MERMAID_CONFIG.write_text(
        json.dumps(
            {
                "theme": "base",
                "themeVariables": {
                    "primaryColor": "#e3f2fd",
                    "primaryTextColor": "#1565c0",
                    "lineColor": "#1976d2",
                    "actorBkg": "#e8f5e9",
                    "actorTextColor": "#1b5e20",
                    "actorLineColor": "#2e7d32",
                },
            },
            indent=2,
        ),
        encoding="utf-8",
    )


def _chrome_executable() -> str | None:
    cache = Path.home() / ".cache" / "puppeteer"
    if not cache.exists():
        return None
    for candidate in cache.glob("chrome-headless-shell/**/chrome-headless-shell"):
        if candidate.is_file():
            return str(candidate)
    return None


def render_mermaid_pngs(text: str, assets_dir: Path) -> tuple[str, int]:
    """Pre-render each mermaid block to PNG; return PDF markdown with <img> tags."""
    assets_dir.mkdir(parents=True, exist_ok=True)
    for old in assets_dir.glob("diagram-*.png"):
        old.unlink()

    ensure_mermaid_config()
    env = os.environ.copy()
    chrome = _chrome_executable()
    if chrome:
        env["PUPPETEER_EXECUTABLE_PATH"] = chrome

    rendered = 0
    failed = 0

    def replacer(match: re.Match[str]) -> str:
        nonlocal rendered, failed
        rendered += 1
        idx = rendered
        content = match.group(1).strip() + "\n"
        mmd_path = assets_dir / f"diagram-{idx:02d}.mmd"
        png_path = assets_dir / f"diagram-{idx:02d}.png"
        mmd_path.write_text(content, encoding="utf-8")

        mmdc_bin = shutil.which("mmdc")
        cmd = (
            [mmdc_bin, "-i", str(mmd_path), "-o", str(png_path), "-b", "transparent", "-c", str(MERMAID_CONFIG)]
            if mmdc_bin
            else [
                "npx",
                "-y",
                "@mermaid-js/mermaid-cli",
                "-i",
                str(mmd_path),
                "-o",
                str(png_path),
                "-b",
                "transparent",
                "-c",
                str(MERMAID_CONFIG),
            ]
        )
        result = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT, env=env)
        if result.returncode != 0 or not png_path.exists():
            failed += 1
            print(f"WARN: mermaid render failed for diagram-{idx:02d}: {result.stderr[:300]}", file=sys.stderr)
            return match.group(0)
        rel = f".pdf-assets/diagram-{idx:02d}.png"
        return f'\n<img src="{rel}" alt="Diagram {idx}" width="100%" />\n'

    pdf_text = re.sub(r"```mermaid\n(.*?)```", replacer, text, flags=re.DOTALL)
    if failed:
        print(f"WARN: {failed}/{rendered} diagrams failed PNG pre-render", file=sys.stderr)
    return pdf_text, rendered - failed


def count_blank_pdf_pages(pdf_path: Path) -> list[int]:
    blank_pages: list[int] = []
    info = subprocess.run(["pdfinfo", str(pdf_path)], capture_output=True, text=True, check=True)
    pages = 0
    for line in info.stdout.splitlines():
        if line.startswith("Pages:"):
            pages = int(line.split(":")[1].strip())
            break
    for page in range(1, pages + 1):
        result = subprocess.run(
            ["pdftotext", "-f", str(page), "-l", str(page), str(pdf_path), "-"],
            capture_output=True,
            text=True,
        )
        chars = len(re.sub(r"\s+", "", result.stdout))
        if chars < 30:
            blank_pages.append(page)
    return blank_pages



def build_pdf_chrome(md_name: str = "EMS_BACKEND_TECHNICAL_DOCUMENTATION.md") -> Path:
    """Pandoc (--toc) + Chrome headless PDF with clickable internal TOC links."""
    docs_dir = DOC.parent.resolve()
    pdf_ready = docs_dir / md_name.replace(".md", ".pdf-ready.md")
    print_html = docs_dir / md_name.replace(".md", ".print.html")
    pdf_path = docs_dir / md_name.replace(".md", ".pdf")
    template = docs_dir / "pdf-template.html"

    subprocess.run(
        ["node", str(docs_dir / "render-mermaid-for-pdf.mjs"), md_name],
        cwd=ROOT,
        check=True,
    )
    if not pdf_ready.exists():
        raise FileNotFoundError(f"Missing {pdf_ready}")

    pandoc = shutil.which("pandoc")
    if not pandoc:
        raise FileNotFoundError("pandoc not found — install with: brew install pandoc")
    subprocess.run(
        [
            pandoc,
            str(pdf_ready),
            "-f",
            "markdown+raw_html",
            "-t",
            "html5",
            "--standalone",
            "--toc",
            "--toc-depth=3",
            "-M",
            "toc-title=Table of Contents",
            "--template",
            str(template),
            "-o",
            str(print_html),
        ],
        cwd=ROOT,
        check=True,
    )
    subprocess.run(["node", str(docs_dir / "build-pdf.mjs")], cwd=ROOT, check=True)
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not created: {pdf_path}")
    return pdf_path


def verify_clickable_toc(pdf_path: Path, print_html: Path) -> dict[str, int | bool]:
    """Confirm pandoc TOC nav + PDF internal link annotations."""
    html = print_html.read_text(encoding="utf-8") if print_html.exists() else ""
    toc_match = re.search(r'<nav id="TOC"[^>]*>([\s\S]*?)</nav>', html)
    toc_href_count = len(re.findall(r'href="#[^"]+"', toc_match.group(1))) if toc_match else 0
    has_toc_nav = toc_match is not None

    internal_links = 0
    try:
        from pypdf import PdfReader

        reader = PdfReader(str(pdf_path))
        for page in reader.pages:
            annots = page.get("/Annots")
            if not annots:
                continue
            for annot in annots:
                obj = annot.get_object()
                if obj.get("/Subtype") != "/Link":
                    continue
                if obj.get("/Dest"):
                    internal_links += 1
                    continue
                action = obj.get("/A")
                if action and action.get("/S") == "/GoTo":
                    internal_links += 1
    except ImportError:
        data = pdf_path.read_bytes()
        internal_links = data.count(b"/Subtype/Link")

    return {
        "toc_nav_present": has_toc_nav,
        "toc_href_count": toc_href_count,
        "pdf_internal_links": internal_links,
        "clickable_toc_ok": has_toc_nav and toc_href_count >= 5 and internal_links >= 5,
    }


def build_pdf_legacy(md_path: Path, pdf_path: Path) -> None:
    if not MAKE_PDF.exists():
        raise FileNotFoundError(f"make-pdf binary not found at {MAKE_PDF}")
    docs_dir = DOC.parent.resolve()
    md_rel = md_path.resolve().relative_to(docs_dir)
    pdf_rel = pdf_path.resolve().relative_to(docs_dir)
    cmd = [
        str(MAKE_PDF),
        "generate",
        "--cover",
        "--toc",
        "--page-numbers",
        str(md_rel),
        str(pdf_rel),
    ]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=docs_dir)
    if result.returncode != 0:
        raise RuntimeError(f"make-pdf failed: {result.stderr}\n{result.stdout}")
    print(result.stdout.strip())


def transform_markdown(text: str) -> tuple[str, dict[str, int]]:
    stats: dict[str, int] = {}
    text = bump_version(text)
    text = update_cover(text)
    text, pb_fixes = fix_page_breaks(text)
    stats["page_break_fixes"] = pb_fixes
    text = reorder_appendices(text)
    text, diagram_count = process_all_mermaid(text)
    stats["diagrams_colored"] = diagram_count
    text = add_section_callouts(text)
    text = add_section_dividers(text)
    text = convert_tables_to_html(text)
    return text, stats


def main() -> int:
    if not DOC.exists():
        print(f"Missing {DOC}", file=sys.stderr)
        return 1

    source = DOC.read_text(encoding="utf-8")
    transformed, stats = transform_markdown(source)
    DOC.write_text(transformed, encoding="utf-8")
    print(f"Updated markdown: {DOC}")
    print(f"  Mermaid diagrams processed: {stats['diagrams_colored']}")
    print(f"  Page-break fixes: {stats['page_break_fixes']}")

    png_count = len(list(ASSETS.glob("diagram-*.png"))) if ASSETS.exists() else 0

    build_pdf_chrome("EMS_BACKEND_TECHNICAL_DOCUMENTATION.md")

    png_count_after = len(list(ASSETS.glob("diagram-*.png")))
    stats["diagrams_prerendered"] = png_count_after
    print(f"  Diagrams pre-rendered to PNG: {png_count_after}")

    print_html = ROOT / "docs" / "EMS_BACKEND_TECHNICAL_DOCUMENTATION.print.html"
    toc_stats = verify_clickable_toc(PDF, print_html)
    stats.update(toc_stats)

    info = subprocess.run(["pdfinfo", str(PDF)], capture_output=True, text=True, check=True)
    pages_line = next((l for l in info.stdout.splitlines() if l.startswith("Pages:")), "Pages: ?")
    page_count = int(pages_line.split(":")[1].strip())
    blank = count_blank_pdf_pages(PDF)
    stats["final_page_count"] = page_count
    stats["blank_pages"] = blank

    print(f"\nPDF: {PDF}")
    print(f"  {pages_line}")
    print(f"  Blank pages detected: {len(blank)} {blank if blank else '✓'}")
    print(f"  TOC nav in HTML: {toc_stats['toc_nav_present']} ({toc_stats['toc_href_count']} href links)")
    print(f"  PDF internal links: {toc_stats['pdf_internal_links']}")
    print(f"  Clickable TOC: {'✓' if toc_stats['clickable_toc_ok'] else '✗ FAILED'}")

    report_path = ROOT / "docs" / "EMS_BACKEND_TECH_DOC_V3_BUILD_REPORT.md"
    report_path.write_text(
        f"""# EMS Backend Technical Doc v3 — Build Report

| Metric | Value |
|--------|-------|
| Mermaid diagrams colored | {stats['diagrams_colored']} |
| Diagrams pre-rendered (PNG) | {stats['diagrams_prerendered']} |
| Page-break fixes applied | {stats['page_break_fixes']} |
| Final PDF page count | {page_count} |
| Blank pages remaining | {len(blank)} {f"({blank})" if blank else "— none"} |
| TOC `<nav id="TOC">` present | {toc_stats['toc_nav_present']} |
| TOC internal href links (HTML) | {toc_stats['toc_href_count']} |
| PDF internal `/Link` annotations | {toc_stats['pdf_internal_links']} |
| Clickable TOC verified | {toc_stats['clickable_toc_ok']} |

## How clickable TOC works

1. `render-mermaid-for-pdf.mjs` strips the manual markdown TOC (broken anchor IDs).
2. Pandoc runs with `--toc --toc-depth=3` and `pdf-template.html` (`$toc$` after cover).
3. Pandoc emits `<nav id="TOC">` with `<a href="#heading-id">` matching auto-generated heading `id`s.
4. Playwright `page.pdf()` preserves internal anchor links as PDF `/Link` + `/Dest` annotations.

Generated by `scripts/build_tech_doc_v3.py`.
""",
        encoding="utf-8",
    )
    print(f"  Report: {report_path}")

    if blank:
        print("WARNING: Blank pages remain — review PDF manually.", file=sys.stderr)
        return 2
    if not toc_stats["clickable_toc_ok"]:
        print("WARNING: Clickable TOC verification failed — check print.html and PDF links.", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
